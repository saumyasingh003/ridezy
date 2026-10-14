import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";
import { verifyAccessToken } from "../utils/jwt.js";
import { setIO, userRoom } from "../realtime/io.js";
import { attachRideCommunication } from "../realtime/rideCommunication.socket.js";

// Chat messages and WebRTC SDP are small; anything bigger is abuse.
const MAX_PAYLOAD_BYTES = 64 * 1024;

export function initSocket(httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: {
      origin: env.corsOrigins,
      credentials: true,
    },
    maxHttpBufferSize: MAX_PAYLOAD_BYTES,
  });

  /*
   * Handshake auth with the same JWT and verifier as the REST API:
   *   io(url, { auth: { token } })
   * Browsers can't set headers on WebSocket connections, hence `auth`;
   * an `Authorization: Bearer` header is accepted too (non-browser clients).
   */
  io.use((socket, next) => {
    const header = socket.handshake.headers.authorization;
    const fromAuth: unknown = socket.handshake.auth?.token;
    const token = typeof fromAuth === "string" ? fromAuth : header?.startsWith("Bearer ") ? header.slice(7) : undefined;

    if (!token) return next(new Error("UNAUTHENTICATED"));
    try {
      socket.data.user = verifyAccessToken(token);
      socket.data.token = token;
      next();
    } catch {
      next(new Error("UNAUTHENTICATED"));
    }
  });

  io.on("connection", (socket) => {
    const { userId } = socket.data.user as { userId: string };
    // One room per user: every tab/device of that user receives their events.
    void socket.join(userRoom(userId));
    logger.info(`Socket connected: ${socket.id} (user ${userId})`);

    socket.on("disconnect", (reason) => {
      logger.info(`Socket disconnected: ${socket.id} (${reason})`);
    });
  });

  attachRideCommunication(io);
  setIO(io);

  return io;
}
