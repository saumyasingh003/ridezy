import type { Request, Response } from "express";
import { z } from "zod";
import * as driverLocationService from "../services/driverLocation.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { coordinatesSchema } from "../utils/validation.js";

/* -------------------------------- Validation -------------------------------- */

// BUSY is deliberately not accepted: the Ride module will set it.
const availabilitySchema = z.object({
  status: z.enum(["AVAILABLE", "OFFLINE"], { error: "Status must be AVAILABLE or OFFLINE" }),
});

// Shared rule: both coordinates required and in range. userId / driverId in
// the body are stripped: the JWT decides whose location this is.

/* -------------------------------- Controllers ------------------------------- */

/** PATCH /api/drivers/availability */
export async function updateAvailability(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { status } = availabilitySchema.parse(req.body ?? {});
  const data = await driverLocationService.setAvailability(userId, status);
  res.json({ success: true, message: status === "AVAILABLE" ? "You are now online." : "You are now offline.", data });
}

/** PATCH /api/drivers/location */
export async function updateLocation(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const coords = coordinatesSchema.parse(req.body ?? {});
  const data = await driverLocationService.updateDriverLocation(userId, coords);
  res.json({ success: true, message: "Location updated successfully.", data });
}

/** GET /api/drivers/location */
export async function getLocation(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const data = await driverLocationService.getDriverLocation(userId);
  res.json({ success: true, message: "Location fetched successfully.", data });
}
