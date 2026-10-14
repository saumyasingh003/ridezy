import type { Request, Response } from "express";
import { z } from "zod";
import * as comms from "../services/rideCommunication.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { objectIdSchema } from "../utils/validation.js";

// Sending messages and everything about calls happens over Socket.IO
// (docs/realtime-events.md). REST only serves what a page needs on load.

const rideParamsSchema = z.object({ rideId: objectIdSchema });

const messagesQuerySchema = z.object({
  before: objectIdSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

/** GET /api/rides/:rideId/communication (PASSENGER, DRIVER) */
export async function getCommunicationStatus(req: Request, res: Response): Promise<void> {
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await comms.getCommunicationStatus(getAuthUser(req), rideId);
  res.json({ success: true, message: "Communication status fetched successfully.", data });
}

/** GET /api/rides/:rideId/messages (PASSENGER, DRIVER) */
export async function listMessages(req: Request, res: Response): Promise<void> {
  const { rideId } = rideParamsSchema.parse(req.params);
  const query = messagesQuerySchema.parse(req.query);
  const data = await comms.listMessages(getAuthUser(req), rideId, query);
  res.json({ success: true, message: "Messages fetched successfully.", data });
}
