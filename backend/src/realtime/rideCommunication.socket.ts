import type { Server, Socket } from "socket.io";
import { z, ZodError } from "zod";
import { MAX_MESSAGE_LENGTH } from "../models/RideMessage.js";
import type { AuthUser } from "../middlewares/auth.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { objectIdSchema } from "../utils/validation.js";
import { env } from "../config/env.js";
import { CommunicationError, type CommunicationErrorCode } from "../services/communicationError.js";
import * as comms from "../services/rideCommunication.service.js";
import * as callSessions from "./callSessions.js";
import { emitToSocket, isUserOnline } from "./io.js";

/*
 * Socket.IO events for ride chat and calls. Contract: docs/realtime-events.md.
 *
 * Every event:
 *   1. re-verifies the JWT (a token can expire while the socket stays open),
 *   2. is rate limited per socket,
 *   3. validates its payload,
 *   4. re-checks ride access against the database (see rideCommunication.service).
 * Request events reply through the Socket.IO acknowledgement callback:
 *   { ok: true, data } | { ok: false, error: { code, message } }
 */

export interface SocketData {
  user: AuthUser;
  token: string;
}
type AppSocket = Socket<Record<string, never>, Record<string, never>, Record<string, never>, SocketData>;

type AckResponse = { ok: true; data: unknown } | { ok: false; error: { code: CommunicationErrorCode; message: string } };

/* -------------------------------- Validation -------------------------------- */

const rideRef = { rideId: objectIdSchema };
const callRef = { ...rideRef, callId: z.uuid("Invalid call id") };

const chatSendSchema = z.object({
  ...rideRef,
  body: z
    .string({ error: "Message is required" })
    .trim()
    .min(1, "Message can't be empty")
    .max(MAX_MESSAGE_LENGTH, `Message must be at most ${MAX_MESSAGE_LENGTH} characters`),
  clientMessageId: z
    .string()
    .regex(/^[A-Za-z0-9_-]{1,64}$/, "clientMessageId must be 1-64 letters, digits, - or _")
    .optional(),
});

const sdpSchema = z.object({
  type: z.enum(["offer", "answer"]),
  sdp: z.string().min(1).max(20_000, "SDP is too large"),
});
const offerSchema = z.object({ ...callRef, description: sdpSchema.refine((d) => d.type === "offer", "Expected an offer") });
const answerSchema = z.object({ ...callRef, description: sdpSchema.refine((d) => d.type === "answer", "Expected an answer") });
const iceSchema = z.object({
  ...callRef,
  candidate: z.object({
    candidate: z.string().max(2000),
    sdpMid: z.string().max(64).nullable().optional(),
    sdpMLineIndex: z.number().int().min(0).max(64).nullable().optional(),
    usernameFragment: z.string().max(256).nullable().optional(),
  }),
});

/* ------------------------------- Rate limiting ------------------------------ */

/** Fixed window per socket, in memory. Enough to stop a runaway client. */
function windowLimiter(max: number, windowMs: number) {
  let windowStart = 0;
  let count = 0;
  return () => {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    count += 1;
    return count <= max;
  };
}

/* ---------------------------------- Errors ---------------------------------- */

function toSocketError(err: unknown): { code: CommunicationErrorCode; message: string } {
  if (err instanceof CommunicationError) return { code: err.code, message: err.message };
  if (err instanceof ZodError) return { code: "VALIDATION_ERROR", message: err.issues[0]?.message ?? "Invalid payload." };
  if (err instanceof AppError) {
    const code: CommunicationErrorCode =
      err.statusCode === 401 ? "UNAUTHENTICATED"
      : err.statusCode === 403 ? "FORBIDDEN"
      : err.statusCode === 404 ? "RIDE_NOT_FOUND"
      : err.statusCode === 400 ? "VALIDATION_ERROR"
      : "INTERNAL_ERROR";
    return { code, message: err.message };
  }
  logger.error("Socket event failed", err);
  return { code: "INTERNAL_ERROR", message: "Something went wrong. Please try again." };
}

/* --------------------------------- Handlers --------------------------------- */

export function registerRideCommunicationHandlers(socket: AppSocket): void {
  const chatLimit = windowLimiter(20, 10_000);
  const signalLimit = windowLimiter(200, 10_000);
  const callLimit = windowLimiter(20, 10_000);

  /**
   * Wraps a handler with re-auth, rate limit, validation and the ack reply.
   * Without an ack callback, errors are emitted as `communication:error`.
   */
  function on<S extends z.ZodType>(
    event: string,
    schema: S,
    limiter: () => boolean,
    handler: (payload: z.infer<S>, user: AuthUser) => Promise<unknown> | unknown,
  ): void {
    (socket as Socket).on(event, async (raw: unknown, ack?: unknown) => {
      const reply = (response: AckResponse) => {
        if (typeof ack === "function") (ack as (r: AckResponse) => void)(response);
        else if (!response.ok) emitToSocket(socket.id, "communication:error", { event, ...response.error });
      };

      let user: AuthUser;
      try {
        user = verifyAccessToken(socket.data.token);
      } catch {
        reply({ ok: false, error: { code: "UNAUTHENTICATED", message: "Your session expired. Please log in again." } });
        socket.disconnect(true);
        return;
      }

      try {
        if (!limiter()) throw new CommunicationError(429, "RATE_LIMITED", "Too many requests. Slow down.");
        const payload = schema.parse(raw ?? {});
        const data = await handler(payload, user);
        reply({ ok: true, data: data ?? null });
      } catch (err) {
        reply({ ok: false, error: toSocketError(err) });
      }
    });
  }

  /* ---------------------------------- Chat ---------------------------------- */

  on("chat:send", chatSendSchema, chatLimit, async (payload, user) => {
    const { message } = await comms.sendMessage(user, payload);
    return { message };
  });

  /* ---------------------------------- Calls --------------------------------- */

  on("call:initiate", z.object(rideRef), callLimit, async ({ rideId }, user) => {
    const p = await comms.assertCanCommunicate(user, rideId);
    if (!(await isUserOnline(p.counterpart.userId))) {
      throw new CommunicationError(409, "PEER_OFFLINE", `${comms.displayNameFallback(p.counterpart.role)} isn't reachable in the app right now.`);
    }
    const [callerName, calleeName] = await Promise.all([
      comms.participantName(p.me.userId, p.me.role),
      comms.participantName(p.counterpart.userId, p.counterpart.role),
    ]);

    const call = callSessions.startCall({
      rideId: p.rideId,
      caller: { ...p.me, name: callerName, socketId: socket.id },
      callee: { ...p.counterpart, name: calleeName },
    });

    // Race guard: the ride may have ended while we were awaiting above.
    // The call is registered now, so either closeRideCommunication() sees and
    // ends it, or this re-read sees the ride already ended. It can't slip by.
    try {
      await comms.assertCanCommunicate(user, rideId);
    } catch (err) {
      callSessions.endCallForRide(p.rideId, "RIDE_ENDED");
      throw err;
    }

    return { call: callSessions.toCallView(call, user.userId), rtc: { iceServers: env.communication.iceServers } };
  });

  on("call:accept", z.object(callRef), callLimit, async ({ rideId, callId }, user) => {
    await comms.assertCanCommunicate(user, rideId);
    const call = callSessions.acceptCall(rideId, callId, user.userId, socket.id);
    return { call: callSessions.toCallView(call, user.userId), rtc: { iceServers: env.communication.iceServers } };
  });

  // Declining or hanging up is always allowed for someone in the call.
  on("call:reject", z.object(callRef), callLimit, ({ rideId, callId }, user) => {
    callSessions.rejectCall(rideId, callId, user.userId);
  });

  on("call:end", z.object(callRef), callLimit, ({ rideId, callId }, user) => {
    callSessions.hangUp(rideId, callId, user.userId);
  });

  on("call:connected", z.object(callRef), callLimit, async ({ rideId, callId }, user) => {
    await comms.assertCanCommunicate(user, rideId);
    const call = callSessions.markConnected(rideId, callId, user.userId);
    return { call: callSessions.toCallView(call, user.userId) };
  });

  /* ---------------------------- WebRTC signaling ---------------------------- */

  async function relay(event: string, rideId: string, callId: string, user: AuthUser, body: Record<string, unknown>) {
    await comms.assertCanCommunicate(user, rideId);
    const target = callSessions.signalTarget(rideId, callId, user.userId, socket.id);
    emitToSocket(target, event, { rideId, callId, ...body });
  }

  on("call:offer", offerSchema, signalLimit, ({ rideId, callId, description }, user) =>
    relay("call:offer", rideId, callId, user, { description }),
  );
  on("call:answer", answerSchema, signalLimit, ({ rideId, callId, description }, user) =>
    relay("call:answer", rideId, callId, user, { description }),
  );
  on("call:ice-candidate", iceSchema, signalLimit, ({ rideId, callId, candidate }, user) =>
    relay("call:ice-candidate", rideId, callId, user, { candidate }),
  );
}

export function attachRideCommunication(io: Server): void {
  io.on("connection", (socket) => {
    const appSocket = socket as unknown as AppSocket;
    registerRideCommunicationHandlers(appSocket);
    callSessions.onSocketConnect(socket.id, appSocket.data.user.userId);
    socket.on("disconnect", () => callSessions.onSocketDisconnect(socket.id));
  });
}
