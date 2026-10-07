import type { Request, Response } from "express";
import { z } from "zod";
import * as adminService from "../services/admin.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { DOCUMENT_TYPES } from "../models/DriverDocument.js";
import { objectIdSchema } from "../utils/validation.js";
import { VEHICLE_TYPES } from "../models/Vehicle.js";
import { findNearbyAvailableDrivers } from "../services/driverLocation.service.js";

/* -------------------------------- Validation -------------------------------- */

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const driverParamsSchema = z.object({ driverId: objectIdSchema });

const rejectSchema = z.object({
  rejectionReason: z
    .string({ error: "Rejection reason is required" })
    .trim()
    .min(5, "Rejection reason must be at least 5 characters")
    .max(500),
  // Optional: which documents caused the rejection.
  documentTypes: z.array(z.enum(DOCUMENT_TYPES)).max(DOCUMENT_TYPES.length).optional(),
});

const nearbyQuerySchema = z.object({
  latitude: z.coerce.number().min(-90, "Latitude must be between -90 and 90").max(90, "Latitude must be between -90 and 90"),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180"),
  radiusMeters: z.coerce.number().int().min(100).max(50_000).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  vehicleType: z.enum(VEHICLE_TYPES).optional(),
});

/* -------------------------------- Controllers ------------------------------- */

/**
 * GET /api/admin/drivers/nearby. ADMIN only: an operations view of the same
 * internal search the Ride module will use. Not exposed to passengers.
 */
export async function nearbyDrivers(req: Request, res: Response): Promise<void> {
  const query = nearbyQuerySchema.parse(req.query);
  const drivers = await findNearbyAvailableDrivers(query);
  res.json({ success: true, message: "Nearby available drivers fetched successfully.", data: drivers });
}

export async function listPendingDrivers(req: Request, res: Response): Promise<void> {
  const query = paginationSchema.parse(req.query);
  const result = await adminService.listPendingDrivers(query);
  res.json({ success: true, message: "Pending drivers fetched successfully.", data: result });
}

export async function verifyDriver(req: Request, res: Response): Promise<void> {
  const { userId: adminId } = getAuthUser(req);
  const { driverId } = driverParamsSchema.parse(req.params);
  const driver = await adminService.verifyDriver(adminId, driverId);
  res.json({ success: true, message: "Driver verified successfully.", data: driver });
}

export async function rejectDriver(req: Request, res: Response): Promise<void> {
  const { userId: adminId } = getAuthUser(req);
  const { driverId } = driverParamsSchema.parse(req.params);
  const input = rejectSchema.parse(req.body ?? {});
  const driver = await adminService.rejectDriver(adminId, driverId, input);
  res.json({ success: true, message: "Driver rejected.", data: driver });
}
