import type { Request, Response } from "express";
import { z } from "zod";
import * as rideService from "../services/ride.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { VEHICLE_TYPES } from "../models/Vehicle.js";
import { objectIdSchema, placeSchema } from "../utils/validation.js";

/* -------------------------------- Validation -------------------------------- */

// Only pickup, destination and vehicle type are accepted. Any distance, duration,
// fare or passengerId the client sends is stripped: the server calculates them.
const rideRequestSchema = z.object({
  pickup: placeSchema,
  destination: placeSchema,
  vehicleType: z.enum(VEHICLE_TYPES, { error: "Vehicle type must be BIKE, AUTO or CAB" }),
});

const rideParamsSchema = z.object({ rideId: objectIdSchema });

const cancelSchema = z.object({
  reason: z.string().trim().min(1).max(300, "Reason must be at most 300 characters").optional(),
});

/* -------------------------------- Controllers ------------------------------- */

/** POST /api/rides/estimate (PASSENGER) */
export async function estimate(req: Request, res: Response): Promise<void> {
  const input = rideRequestSchema.parse(req.body ?? {});
  const data = await rideService.estimateRide(input);
  res.json({ success: true, message: "Ride estimate calculated successfully.", data });
}

/** POST /api/rides (PASSENGER) */
export async function bookRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = rideRequestSchema.parse(req.body ?? {});
  const { ride, driversContacted, message } = await rideService.bookRide(userId, input);
  res.status(201).json({ success: true, message, data: { ...ride, driversContacted } });
}

/** GET /api/rides/current (PASSENGER, DRIVER) */
export async function getCurrentRide(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const data = await rideService.getCurrentRide(viewer);
  res.json({ success: true, message: "Current ride fetched successfully.", data });
}

/** GET /api/rides/:rideId (owner passenger, offered/assigned driver, ADMIN) */
export async function getRide(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await rideService.getRide(viewer, rideId);
  res.json({ success: true, message: "Ride fetched successfully.", data });
}

/** PATCH /api/rides/:rideId/cancel (PASSENGER) */
export async function cancelRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const { reason } = cancelSchema.parse(req.body ?? {});
  const data = await rideService.cancelRide(userId, rideId, reason);
  res.json({ success: true, message: "Ride cancelled.", data });
}

/** POST /api/rides/:rideId/accept (DRIVER) */
export async function acceptRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await rideService.acceptRide(userId, rideId);
  res.json({ success: true, message: "Ride accepted. Head to the pickup point.", data });
}

/** POST /api/rides/:rideId/reject (DRIVER) */
export async function rejectRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  await rideService.rejectRide(userId, rideId);
  res.json({ success: true, message: "Ride request declined." });
}

/** GET /api/drivers/rides/requests (DRIVER) */
export async function listRideRequests(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const data = await rideService.listRideRequests(userId);
  res.json({ success: true, message: "Ride requests fetched successfully.", data });
}
