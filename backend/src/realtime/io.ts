import type { Server } from "socket.io";

/*
 * The Socket.IO server, reachable from services without importing
 * config/socket.ts (which would create an import cycle). It is null when the
 * app runs without sockets (most REST tests): emits are then simply skipped.
 */
let io: Server | null = null;

export function setIO(server: Server | null): void {
  io = server;
}

export function getIO(): Server | null {
  return io;
}

/**
 * Every authenticated socket joins its user's room, so one emit reaches all of
 * a user's tabs/devices. Ride events are always sent to the participants'
 * user rooms (looked up from the database at send time), never to a "ride
 * room": a driver who loses access can't keep receiving through a stale join.
 */
export function userRoom(userId: string): string {
  return `user:${userId}`;
}

export function emitToUsers(userIds: string[], event: string, payload: unknown): void {
  if (!io || userIds.length === 0) return;
  io.to(userIds.map(userRoom)).emit(event, payload);
}

export function emitToSocket(socketId: string, event: string, payload: unknown): void {
  io?.to(socketId).emit(event, payload);
}

export async function isUserOnline(userId: string): Promise<boolean> {
  if (!io) return false;
  return (await io.in(userRoom(userId)).fetchSockets()).length > 0;
}
