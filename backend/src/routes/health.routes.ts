import { Router } from "express";
import { pingDB } from "../config/db.js";

export const healthRouter = Router();

// 200 when the database answers, 503 otherwise (used by Docker's healthcheck).
healthRouter.get("/", async (_req, res) => {
  const database = await pingDB().then(
    () => "up" as const,
    () => "down" as const,
  );

  res.status(database === "up" ? 200 : 503).json({
    status: database === "up" ? "ok" : "degraded",
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    services: { database },
  });
});
