import type { Request, Response } from "express";
import { z } from "zod";
import * as rideService from "../services/ride.service.js";
import * as ratingService from "../services/rating.service.js";
import { MAX_COMMENT_LENGTH, MAX_SCORE, MIN_SCORE } from "../models/Rating.js";
import { countNearbyAvailableByType } from "../services/driverLocation.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { VEHICLE_TYPES } from "../models/Vehicle.js";
import { RIDE_STATUSES } from "../models/Ride.js";
import { DRIVER_TIP_OPTIONS } from "../models/Payment.js";
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

const tipSchema = z.object({
  tip: z.union(DRIVER_TIP_OPTIONS.map((value) => z.literal(value)), { error: "Tip must be 0, 20, 40, 50 or 60" }),
});

const startSchema = z.object({
  otp: z.string({ error: "Ride OTP is required" }).trim().regex(/^\d{4}$/, "Ride OTP must be 4 digits"),
});

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(RIDE_STATUSES, { error: "Unknown ride status" }).optional(),
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
  const result = await rideService.rejectRide(userId, rideId);
  res.json({ success: true, message: result?.message || "Ride request declined." });
}

/** GET /api/drivers/rides/requests (DRIVER) */
export async function listRideRequests(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const data = await rideService.listRideRequests(userId);
  res.json({ success: true, message: "Ride requests fetched successfully.", data });
}

/** POST /api/rides/:rideId/arrive (assigned DRIVER) */
export async function arriveAtPickup(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await rideService.arriveAtPickup(userId, rideId);
  res.json({ success: true, message: "Passenger notified that you have arrived.", data });
}

/** POST /api/rides/:rideId/start (assigned DRIVER, with the passenger's OTP) */
export async function startRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const { otp } = startSchema.parse(req.body ?? {});
  const data = await rideService.startRide(userId, rideId, otp);
  res.json({ success: true, message: "Ride started. Drive safely.", data });
}

/** POST /api/rides/:rideId/complete (assigned DRIVER) */
export async function completeRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await rideService.completeRide(userId, rideId);
  res.json({ success: true, message: "Ride completed.", data });
}

/** GET /api/rides/history (PASSENGER, DRIVER) */
export async function getRideHistory(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const query = historyQuerySchema.parse(req.query);
  const data = await rideService.listRideHistory(viewer, query);
  res.json({ success: true, message: "Rides fetched successfully.", data });
}

/** POST /api/rides/:rideId/match (the ride's PASSENGER): search for drivers again */
export async function restartMatching(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const { ride, driversContacted, newlyContacted, message } = await rideService.restartMatching(userId, rideId);
  res.status(202).json({ success: true, message, data: { ...ride, driversContacted, newlyContacted } });
}

/** GET /api/rides/:rideId/driver (the ride's PASSENGER) */
export async function getAssignedDriver(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await rideService.getAssignedDriver(userId, rideId);
  res.json({ success: true, message: "Driver fetched successfully.", data });
}

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number({ error: "Latitude is required" }).min(-90).max(90),
  longitude: z.coerce.number({ error: "Longitude is required" }).min(-180).max(180),
});

/** GET /api/rides/nearby-drivers?latitude=&longitude= (PASSENGER): counts per vehicle type */
export async function nearbyDrivers(req: Request, res: Response): Promise<void> {
  const point = nearbyQuerySchema.parse(req.query);
  const data = await countNearbyAvailableByType(point);
  res.json({ success: true, message: "Nearby drivers counted successfully.", data });
}

const ratingSchema = z.object({
  score: z
    .number({ error: "Score is required and must be a number" })
    .int("Score must be a whole number")
    .min(MIN_SCORE, `Score must be between ${MIN_SCORE} and ${MAX_SCORE}`)
    .max(MAX_SCORE, `Score must be between ${MIN_SCORE} and ${MAX_SCORE}`),
  comment: z.string().trim().max(MAX_COMMENT_LENGTH, `Comment must be at most ${MAX_COMMENT_LENGTH} characters`).optional(),
});

/** POST /api/rides/:rideId/rating (the ride's PASSENGER rates the driver, after paying) */
export async function rateRide(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const input = ratingSchema.parse(req.body ?? {});
  const data = await ratingService.rateRide(viewer, rideId, input);
  res.status(201).json({ success: true, message: "Rating submitted successfully.", data });
}

/** GET /api/rides/:rideId/rating (the ride's passenger or driver, or ADMIN) */
export async function getRideRatings(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const data = await ratingService.getRideRatings(viewer, rideId);
  res.json({ success: true, message: "Ratings fetched successfully.", data });
}

const receivedRatingsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  score: z.coerce.number().int().min(MIN_SCORE).max(MAX_SCORE).optional(),
});

/** GET /api/ratings/me (DRIVER): ratings riders gave me, with a summary */
export async function getMyRatings(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const query = receivedRatingsQuerySchema.parse(req.query);
  const data = await ratingService.listReceivedRatings(viewer, query);
  res.json({ success: true, message: "Ratings fetched successfully.", data });
}

/** PATCH /api/rides/:rideId/tip (PASSENGER) */
export async function setRideTip(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const { tip } = tipSchema.parse(req.body ?? {});
  const data = await rideService.setRideTip(userId, rideId, tip);
  res.json({ success: true, message: tip > 0 ? `Tip of ₹${tip} added for your driver.` : "Tip removed.", data });
}
