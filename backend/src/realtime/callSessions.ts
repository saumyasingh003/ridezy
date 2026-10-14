import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import type { MessageSenderRole } from "../models/RideMessage.js";
import { emitToSocket, emitToUsers } from "./io.js";
import { CommunicationError } from "../services/communicationError.js";

/*
 * In-app voice calls. Audio flows browser-to-browser over WebRTC; this module
 * only tracks who is calling whom and relays the WebRTC handshake.
 *
 *   RINGING ──accept──► CONNECTING ──client reports RTC "connected"──► ACTIVE
 *      │                    │                                          │
 *      └── reject / cancel / no answer / connect timeout / hang up / ride ends ──► (removed)
 *
 * A call only becomes ACTIVE when a browser reports that its RTCPeerConnection
 * actually connected; "accepted" over Socket.IO alone is not a working call.
 *
 * State lives in memory: fine for one server process. Several instances would
 * need shared state (e.g. a Socket.IO adapter), which isn't justified yet.
 */

export type CallState = "RINGING" | "CONNECTING" | "ACTIVE";
export type CallEndReason =
  | "REJECTED" // callee declined
  | "CANCELLED" // caller hung up before it was answered
  | "NO_ANSWER" // ring timeout
  | "ENDED" // hung up after answering
  | "CONNECTION_FAILED" // accepted, but audio never connected in time
  | "PEER_DISCONNECTED" // a participant's socket dropped and didn't come back
  | "RIDE_ENDED" // ride completed or cancelled
  | "ACCESS_REVOKED"; // a participant lost access (e.g. driver reassigned)

interface Party {
  userId: string;
  role: MessageSenderRole;
  name: string;
  /** The one socket (tab) taking part. Null while ringing (callee) or after a drop. */
  socketId: string | null;
  graceTimer?: NodeJS.Timeout;
}

interface CallSession {
  callId: string;
  rideId: string;
  state: CallState;
  caller: Party;
  callee: Party;
  createdAt: Date;
  answeredAt?: Date;
  connectedAt?: Date;
  /** Ring timeout while RINGING, connect timeout while CONNECTING. */
  timer?: NodeJS.Timeout;
}

/** At most one call per ride (and a user has at most one active ride). */
const calls = new Map<string, CallSession>();

function later(ms: number, fn: () => void): NodeJS.Timeout {
  const timer = setTimeout(fn, ms);
  timer.unref(); // never keep the process alive just for a call timer
  return timer;
}

export interface CallView {
  callId: string;
  rideId: string;
  state: CallState;
  direction: "OUTGOING" | "INCOMING";
  caller: { role: MessageSenderRole; name: string };
  callee: { role: MessageSenderRole; name: string };
  createdAt: Date;
  connectedAt: Date | null;
}

export function toCallView(call: CallSession, viewerUserId: string): CallView {
  return {
    callId: call.callId,
    rideId: call.rideId,
    state: call.state,
    direction: call.caller.userId === viewerUserId ? "OUTGOING" : "INCOMING",
    caller: { role: call.caller.role, name: call.caller.name },
    callee: { role: call.callee.role, name: call.callee.name },
    createdAt: call.createdAt,
    connectedAt: call.connectedAt ?? null,
  };
}

export function getCallForRide(rideId: string): CallSession | undefined {
  return calls.get(rideId);
}

function partyOf(call: CallSession, userId: string): Party | undefined {
  if (call.caller.userId === userId) return call.caller;
  if (call.callee.userId === userId) return call.callee;
  return undefined;
}

/** The ride's call, if `callId` matches and `userId` is in it. */
function findCall(rideId: string, callId: string, userId: string): { call: CallSession; me: Party; peer: Party } {
  const call = calls.get(rideId);
  const me = call && call.callId === callId ? partyOf(call, userId) : undefined;
  if (!call || !me) throw new CommunicationError(404, "CALL_NOT_FOUND", "This call has already ended.");
  return { call, me, peer: me === call.caller ? call.callee : call.caller };
}

function finish(call: CallSession, reason: CallEndReason): void {
  if (calls.get(call.rideId) !== call) return; // already finished
  calls.delete(call.rideId);
  clearTimeout(call.timer);
  clearTimeout(call.caller.graceTimer);
  clearTimeout(call.callee.graceTimer);

  const durationSeconds = call.connectedAt ? Math.round((Date.now() - call.connectedAt.getTime()) / 1000) : 0;
  // Both user rooms: this also stops ringing on the callee's other tabs.
  emitToUsers([call.caller.userId, call.callee.userId], "call:ended", {
    callId: call.callId,
    rideId: call.rideId,
    reason,
    durationSeconds,
  });
}

/* --------------------------------- Actions --------------------------------- */

export function startCall(input: {
  rideId: string;
  caller: { userId: string; role: MessageSenderRole; name: string; socketId: string };
  callee: { userId: string; role: MessageSenderRole; name: string };
}): CallSession {
  // Synchronous check-and-set: two people pressing "Call" at the same moment
  // can't both create a call, because nothing awaits between these lines.
  if (calls.has(input.rideId)) {
    throw new CommunicationError(409, "CALL_BUSY", "A call is already in progress for this ride.");
  }

  const call: CallSession = {
    callId: randomUUID(),
    rideId: input.rideId,
    state: "RINGING",
    caller: { ...input.caller },
    callee: { ...input.callee, socketId: null },
    createdAt: new Date(),
  };
  call.timer = later(env.communication.ringTimeoutMs, () => finish(call, "NO_ANSWER"));
  calls.set(call.rideId, call);

  emitToUsers([call.callee.userId], "call:incoming", toCallView(call, call.callee.userId));
  return call;
}

/** The callee answers on one tab; that tab becomes their end of the call. */
export function acceptCall(rideId: string, callId: string, userId: string, socketId: string): CallSession {
  const { call, me } = findCall(rideId, callId, userId);
  if (me !== call.callee) throw new CommunicationError(403, "FORBIDDEN", "Only the person being called can accept.");
  if (call.state !== "RINGING") throw new CommunicationError(409, "CALL_ALREADY_ANSWERED", "This call was already answered.");

  call.state = "CONNECTING";
  call.answeredAt = new Date();
  call.callee.socketId = socketId;
  clearTimeout(call.timer);
  call.timer = later(env.communication.connectTimeoutMs, () => finish(call, "CONNECTION_FAILED"));

  // To both users: the caller now sends the WebRTC offer, and the callee's
  // other tabs stop ringing.
  emitToUsers([call.caller.userId, call.callee.userId], "call:accepted", {
    callId: call.callId,
    rideId: call.rideId,
    acceptedOnSocketId: socketId,
  });
  return call;
}

export function rejectCall(rideId: string, callId: string, userId: string): void {
  const { call, me } = findCall(rideId, callId, userId);
  if (me !== call.callee) throw new CommunicationError(403, "FORBIDDEN", "Only the person being called can reject.");
  if (call.state !== "RINGING") throw new CommunicationError(409, "CALL_ALREADY_ANSWERED", "This call was already answered.");
  finish(call, "REJECTED");
}

/** Either side hangs up, at any stage. Always allowed for a participant. */
export function hangUp(rideId: string, callId: string, userId: string): void {
  const { call, me } = findCall(rideId, callId, userId);
  finish(call, call.state === "RINGING" && me === call.caller ? "CANCELLED" : "ENDED");
}

/** A browser reports its RTCPeerConnection reached "connected": audio is flowing. */
export function markConnected(rideId: string, callId: string, userId: string): CallSession {
  const { call } = findCall(rideId, callId, userId);
  if (call.state === "RINGING") throw new CommunicationError(409, "CALL_NOT_ANSWERED", "The call hasn't been answered yet.");
  if (call.state === "CONNECTING") {
    call.state = "ACTIVE";
    call.connectedAt = new Date();
    clearTimeout(call.timer);
    call.timer = undefined;
    emitToUsers([call.caller.userId, call.callee.userId], "call:active", {
      callId: call.callId,
      rideId: call.rideId,
      connectedAt: call.connectedAt,
    });
  }
  return call;
}

/**
 * WebRTC handshake relay (offer / answer / ICE candidates): only between the
 * two sockets bound to the call, and only after it was answered.
 * Returns the peer's socket id.
 */
export function signalTarget(rideId: string, callId: string, userId: string, socketId: string): string {
  const { call, me, peer } = findCall(rideId, callId, userId);
  if (call.state === "RINGING") throw new CommunicationError(409, "CALL_NOT_ANSWERED", "The call hasn't been answered yet.");
  if (me.socketId !== socketId) {
    throw new CommunicationError(403, "FORBIDDEN", "This call is connected on another device.");
  }
  if (!peer.socketId) throw new CommunicationError(409, "PEER_RECONNECTING", "The other person is reconnecting.");
  return peer.socketId;
}

/* -------------------------------- Lifecycle -------------------------------- */

/** The ride completed/was cancelled, or a participant lost access: end its call now. */
export function endCallForRide(rideId: string, reason: CallEndReason): void {
  const call = calls.get(rideId);
  if (call) finish(call, reason);
}

/**
 * A socket dropped. Its call isn't ended immediately: WebRTC audio is
 * peer-to-peer and keeps flowing through a short signaling outage, so the
 * user gets a grace period to reconnect before the call is torn down.
 */
export function onSocketDisconnect(socketId: string): void {
  for (const call of calls.values()) {
    for (const party of [call.caller, call.callee]) {
      if (party.socketId !== socketId) continue;
      party.socketId = null;
      party.graceTimer = later(env.communication.reconnectGraceMs, () => finish(call, "PEER_DISCONNECTED"));
    }
  }
}

/** A user's new socket: resume a call they dropped out of, or re-show a ringing one. */
export function onSocketConnect(socketId: string, userId: string): void {
  for (const call of calls.values()) {
    const party = partyOf(call, userId);
    if (!party) continue;

    if (party.graceTimer && party.socketId === null) {
      clearTimeout(party.graceTimer);
      party.graceTimer = undefined;
      party.socketId = socketId;
      // A page reload loses the RTCPeerConnection; such a client should hang up.
      emitToSocket(socketId, "call:resumed", toCallView(call, userId));
    } else if (call.state === "RINGING" && party === call.callee) {
      emitToSocket(socketId, "call:incoming", toCallView(call, userId));
    }
  }
}
