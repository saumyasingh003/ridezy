import { createServer } from "node:http";
import { env } from "./config/env.js";
import { connectDB, disconnectDB } from "./config/db.js";
import { initSocket } from "./config/socket.js";
import { createApp } from "./app.js";
import { logger } from "./utils/logger.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function main(): Promise<void> {
  await connectDB();

  const app = createApp();
  const httpServer = createServer(app);
  const io = initSocket(httpServer);

  httpServer.listen(env.port, () => {
    logger.info(`✅ Server listening on port ${env.port} (${env.nodeEnv})`);
  });

  let shuttingDown = false;

  async function shutdown(signal: string, exitCode = 0): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received, shutting down gracefully...`);

    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing exit");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    try {
      // Disconnects all sockets and closes the underlying HTTP server.
      await io.close();
      logger.info("HTTP and Socket.IO servers closed");

      await disconnectDB();
      process.exit(exitCode);
    } catch (err) {
      logger.error("Error during shutdown", err);
      process.exit(1);
    }
  }

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("unhandledRejection", (reason) => {
    logger.error("Unhandled promise rejection", reason);
    void shutdown("unhandledRejection", 1);
  });
  process.on("uncaughtException", (err) => {
    logger.error("Uncaught exception", err);
    void shutdown("uncaughtException", 1);
  });
}

main().catch(async (err: unknown) => {
  logger.error("Failed to start server", err);
  await disconnectDB().catch(() => undefined);
  process.exit(1);
});
