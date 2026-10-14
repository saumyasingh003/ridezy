import mongoose, { isValidObjectId, type ClientSession, type Types } from "mongoose";
import { env } from "../config/env.js";
import { DRIVER_ACTIVE_STATUSES, Ride, type RideStatus } from "../models/Ride.js";
import { DriverProfile } from "../models/DriverProfile.js";
import { User } from "../models/User.js";
import { MAX_MESSAGE_LENGTH, RideMessage, type MessageSenderRole, type RideMessageDocument } from "../models/RideMessage.js";
import type { AuthUser } from "../middlewares/auth.js";
import { duplicateKeyField } from "../utils/mongo.js";
import { emitToUsers, isUserOnline } from "../realtime/io.js";
import { endCallForRide, getCallForRide, toCallView } from "../realtime/callSessions.js";
import { CommunicationError } from "./communicationError.js";

/*
 * Ride chat & calling: who may talk, and when.
 *
 * - Only the ride's passenger and its *currently* assigned driver. Both are
 *   read from the database on every check, never cached on the socket, so a
 *   driver who loses the ride loses access on their very next action.
 * - Only while the ride is active after a driver accepted it:
 *   DRIVER_ASSIGNED → DRIVER_ARRIVING → DRIVER_ARRIVED → RIDE_STARTED.
 * - Chat history stays readable (read-only) for both after the ride ends.
 */

/** Statuses in which new messages and calls are allowed. */
export const COMMUNICATION_OPEN_STATUSES: readonly RideStatus[] = DRIVER_ACTIVE_STATUSES;

export type CommunicationClosedReason = "WAITING_FOR_DRIVER" | "RIDE_COMPLETED" | "RIDE_CANCELLED";

function closedReason(status: RideStatus): CommunicationClosedReason | null {
  if (status === "SEARCHING") return "WAITING_FOR_DRIVER";
  if (status === "RIDE_COMPLETED") return "RIDE_COMPLETED";
  if (status === "CANCELLED") return "RIDE_CANCELLED";
  return null;
}

/* =============================== Access check ============================== */

export interface Participant {
  rideId: string;
  rideStatus: RideStatus;
  me: { userId: string; role: MessageSenderRole };
  /** Null while no driver is assigned yet. */
  counterpart: { userId: string; role: MessageSenderRole } | null;
  passengerId: Types.ObjectId;
  driverProfileId: Types.ObjectId | null;
  closedReason: CommunicationClosedReason | null;
}

const rideNotFound = () => new CommunicationError(404, "RIDE_NOT_FOUND", "Ride not found.");

/**
 * Is `viewer` the passenger or the current assigned driver of this ride?
 * Anyone else (including a previously assigned driver) gets 404, the same as
 * for a ride that doesn't exist, so ride ids can't be probed.
 */
export async function resolveParticipant(viewer: AuthUser, rideId: string): Promise<Participant> {
  if (!isValidObjectId(rideId)) throw new CommunicationError(400, "VALIDATION_ERROR", "Invalid ride id.");
  if (viewer.role !== "PASSENGER" && viewer.role !== "DRIVER") {
    throw new CommunicationError(403, "FORBIDDEN", "Only the ride's passenger and driver can communicate.");
  }

  const ride = await Ride.findById(rideId, { passengerId: 1, assignedDriverId: 1, status: 1 });
  if (!ride) throw rideNotFound();

  // assignedDriverId is a DriverProfile id; the JWT carries a User id.
  const driver = ride.assignedDriverId ? await DriverProfile.findById(ride.assignedDriverId, { userId: 1 }) : null;
  const driverUserId = driver ? String(driver.userId) : null;
  const passengerUserId = String(ride.passengerId);

  let me: Participant["me"];
  let counterpart: Participant["counterpart"];
  if (viewer.role === "PASSENGER" && viewer.userId === passengerUserId) {
    me = { userId: passengerUserId, role: "PASSENGER" };
    counterpart = driverUserId ? { userId: driverUserId, role: "DRIVER" } : null;
  } else if (viewer.role === "DRIVER" && driverUserId !== null && viewer.userId === driverUserId) {
    me = { userId: driverUserId, role: "DRIVER" };
    counterpart = { userId: passengerUserId, role: "PASSENGER" };
  } else {
    throw rideNotFound();
  }

  const status = ride.status as RideStatus;
  return {
    rideId: String(ride._id),
    rideStatus: status,
    me,
    counterpart,
    passengerId: ride.passengerId,
    driverProfileId: ride.assignedDriverId ?? null,
    closedReason: closedReason(status),
  };
}

function closedError(reason: CommunicationClosedReason): CommunicationError {
  if (reason === "WAITING_FOR_DRIVER") {
    return new CommunicationError(409, "COMMUNICATION_NOT_STARTED", "Chat and calls open once a driver accepts the ride.");
  }
  return new CommunicationError(
    409,
    "COMMUNICATION_CLOSED",
    reason === "RIDE_COMPLETED" ? "This ride is completed. Chat and calls are closed." : "This ride was cancelled. Chat and calls are closed.",
  );
}

/** A participant of an active ride, with the other side known. */
export async function assertCanCommunicate(viewer: AuthUser, rideId: string) {
  const participant = await resolveParticipant(viewer, rideId);
  if (participant.closedReason) throw closedError(participant.closedReason);
  if (!participant.counterpart) throw closedError("WAITING_FOR_DRIVER");
  return participant as Participant & { counterpart: NonNullable<Participant["counterpart"]> };
}

async function nameOf(userId: string, fallback: string): Promise<string> {
  return (await User.findById(userId, { name: 1 }))?.name ?? fallback;
}

export function displayNameFallback(role: MessageSenderRole): string {
  return role === "DRIVER" ? "Your driver" : "Your passenger";
}

export async function participantName(userId: string, role: MessageSenderRole): Promise<string> {
  return nameOf(userId, displayNameFallback(role));
}

/* ================================== Status ================================= */

/**
 * The other participant as shown on the ride screen. The phone number lets
 * them call each other directly, so it is only revealed to the two
 * participants while the ride is active; once it ends it becomes null.
 */
async function counterpartView(counterpart: { userId: string; role: MessageSenderRole }, open: boolean) {
  const user = await User.findById(counterpart.userId, { name: 1, phone: 1 });
  return {
    role: counterpart.role,
    name: user?.name ?? displayNameFallback(counterpart.role),
    phone: open ? (user?.phone ?? null) : null,
    online: open ? await isUserOnline(counterpart.userId) : false,
  };
}

/** GET /api/rides/:rideId/communication */
export async function getCommunicationStatus(viewer: AuthUser, rideId: string) {
  const p = await resolveParticipant(viewer, rideId);
  const open = !p.closedReason && p.counterpart !== null;
  const call = open ? getCallForRide(p.rideId) : undefined;

  return {
    rideId: p.rideId,
    rideStatus: p.rideStatus,
    canChat: open,
    canCall: open,
    closedReason: p.closedReason,
    you: { role: p.me.role },
    counterpart: p.counterpart ? await counterpartView(p.counterpart, open) : null,
    activeCall: call ? toCallView(call, p.me.userId) : null,
    limits: { maxMessageLength: MAX_MESSAGE_LENGTH },
    rtc: {
      iceServers: env.communication.iceServers,
      ringTimeoutSeconds: env.communication.ringTimeoutMs / 1000,
    },
  };
}

/* ================================== Chat =================================== */

export function toMessageView(message: RideMessageDocument) {
  return {
    id: String(message._id),
    rideId: String(message.rideId),
    senderId: String(message.senderId),
    senderRole: message.senderRole,
    body: message.body,
    clientMessageId: message.clientMessageId ?? null,
    createdAt: message.createdAt,
  };
}
export type MessageView = ReturnType<typeof toMessageView>;

export interface MessagePageQuery {
  before?: string;
  limit: number;
}

/**
 * GET /api/rides/:rideId/messages: cursor pagination. `before` is the oldest
 * message id the client already has; each page is returned oldest → newest.
 * Cursors (unlike page numbers) don't shift when new messages arrive.
 */
export async function listMessages(viewer: AuthUser, rideId: string, { before, limit }: MessagePageQuery) {
  const p = await resolveParticipant(viewer, rideId);

  const rows = await RideMessage.find({ rideId: p.rideId, ...(before ? { _id: { $lt: before } } : {}) })
    .sort({ _id: -1 })
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit).reverse();
  return {
    messages: page.map(toMessageView),
    hasMore,
    nextCursor: hasMore && page[0] ? String(page[0]._id) : null,
  };
}

export interface SendMessageInput {
  rideId: string;
  body: string;
  clientMessageId?: string;
}

/**
 * Saves a message, then delivers it to both participants.
 *
 * Race with complete/cancel: the insert shares a transaction with a write to
 * the ride (`lastMessageAt`) that only matches while the ride is still active
 * and still assigned to the sender. complete/cancel also write that ride, so
 * MongoDB serialises the two: either the message commits first (it's part of
 * the ride), or the ride ends first and the message is refused. Never both.
 */
export async function sendMessage(viewer: AuthUser, input: SendMessageInput): Promise<{ message: MessageView; duplicate: boolean }> {
  const p = await assertCanCommunicate(viewer, input.rideId);

  const findExisting = () =>
    input.clientMessageId
      ? RideMessage.findOne({ rideId: p.rideId, senderId: p.me.userId, clientMessageId: input.clientMessageId })
      : null;

  const earlier = await findExisting();
  if (earlier) return { message: toMessageView(earlier), duplicate: true };

  let saved: RideMessageDocument | undefined;
  try {
    await mongoose.connection.transaction(async (session: ClientSession) => {
      const stillOpen = await Ride.updateOne(
        {
          _id: p.rideId,
          status: { $in: COMMUNICATION_OPEN_STATUSES },
          ...(p.me.role === "PASSENGER" ? { passengerId: p.passengerId } : { assignedDriverId: p.driverProfileId }),
        },
        { $set: { lastMessageAt: new Date() } },
        { session, timestamps: false },
      );
      if (stillOpen.matchedCount === 0) {
        throw new CommunicationError(409, "COMMUNICATION_CLOSED", "This ride has ended. Chat is closed.");
      }

      [saved] = await RideMessage.create(
        [
          {
            rideId: p.rideId,
            senderId: p.me.userId,
            senderRole: p.me.role,
            body: input.body,
            ...(input.clientMessageId ? { clientMessageId: input.clientMessageId } : {}),
          },
        ],
        { session },
      );
    });
  } catch (err) {
    // Two copies of the same resend raced each other: return the winner.
    if (duplicateKeyField(err) === "clientMessageId") {
      const winner = await findExisting();
      if (winner) return { message: toMessageView(winner), duplicate: true };
    }
    throw err;
  }

  const message = toMessageView(saved as unknown as RideMessageDocument);
  emitToUsers([p.me.userId, p.counterpart.userId], "chat:message", message);
  return { message, duplicate: false };
}

/* ================================ Lifecycle ================================ */

export type CommunicationEndReason = "RIDE_COMPLETED" | "RIDE_CANCELLED" | "DRIVER_REASSIGNED";

/**
 * Call right after a ride-ending (or driver-changing) write has committed.
 * Ends any call immediately and tells the affected users that communication
 * is closed. Access itself is already gone at that point: every later
 * event re-checks the database.
 *
 * - RIDE_COMPLETED / RIDE_CANCELLED: notify passenger and driver.
 * - DRIVER_REASSIGNED: notify only the previous driver (pass their user id).
 *   Any future reassignment flow must call this.
 */
export function closeRideCommunication(rideId: string, reason: CommunicationEndReason, notifyUserIds: string[]): void {
  endCallForRide(rideId, reason === "DRIVER_REASSIGNED" ? "ACCESS_REVOKED" : "RIDE_ENDED");
  emitToUsers(notifyUserIds, "communication:closed", { rideId, reason });
}
