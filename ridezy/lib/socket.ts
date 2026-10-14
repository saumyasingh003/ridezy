"use client";

// One shared Socket.IO connection for the whole app (backend/docs/realtime-events.md).
// Authenticated with the same JWT as the REST API.

import { io, type Socket } from "socket.io-client";
import { API_BASE } from "./rideApi";

const SOCKET_URL = API_BASE.replace(/\/api\/?$/, "");

let socket: Socket | null = null;
let socketToken: string | null = null;

/** The shared socket for the logged-in user, or null when logged out. */
export function getSocket(): Socket | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem("token");
  if (!token) return null;

  // A different user logged in: drop the old connection.
  if (socket && socketToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socketToken = token;
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnectionDelay: 1000,
      reconnectionDelayMax: 10_000,
    });
  }
  return socket;
}

/** Server acknowledgement for request events. */
export type SocketAck<T> = { ok: true; data: T } | { ok: false; error: { code: string; message: string } };

/** emit + wait for the ack; a timeout or dropped connection becomes an error ack. */
export async function request<T>(event: string, payload: unknown, timeoutMs = 8000): Promise<SocketAck<T>> {
  const s = getSocket();
  if (!s) return { ok: false, error: { code: "UNAUTHENTICATED", message: "Please log in again." } };
  if (!s.connected) return { ok: false, error: { code: "OFFLINE", message: "You're offline. Reconnecting…" } };
  try {
    return (await s.timeout(timeoutMs).emitWithAck(event, payload)) as SocketAck<T>;
  } catch {
    return { ok: false, error: { code: "TIMEOUT", message: "No response from the server. Try again." } };
  }
}
