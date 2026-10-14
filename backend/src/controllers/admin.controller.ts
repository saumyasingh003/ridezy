import type { Request, Response } from "express";
import { z } from "zod";
import * as adminService from "../services/admin.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { DOCUMENT_TYPES } from "../models/DriverDocument.js";
import { objectIdSchema } from "../utils/validation.js";
import { VEHICLE_TYPES } from "../models/Vehicle.js";
import { User } from "../models/User.js";
import { findNearbyAvailableDrivers } from "../services/driverLocation.service.js";
import { saveImageAndGetLink } from "../utils/imageStorage.js";

/* -------------------------------- Validation -------------------------------- */

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const driverParamsSchema = z.object({ driverId: objectIdSchema });

const rejectSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(3, "Rejection reason must be at least 3 characters")
    .max(500)
    .default("Driver profile does not meet platform verification standards."),
  // Optional: which documents caused the rejection.
  documentTypes: z.array(z.enum(DOCUMENT_TYPES)).max(DOCUMENT_TYPES.length).optional(),
});

const nearbyQuerySchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, "Latitude must be between -90 and 90")
    .max(90, "Latitude must be between -90 and 90")
    .default(28.6139),
  longitude: z.coerce
    .number()
    .min(-180, "Longitude must be between -180 and 180")
    .max(180, "Longitude must be between -180 and 180")
    .default(77.2090),
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
  const userIds = drivers.map((d) => d.userId).filter(Boolean);
  const users = userIds.length ? await User.find({ _id: { $in: userIds } }, { name: 1, phone: 1, email: 1 }) : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));
  const enriched = drivers.map((d) => {
    const u = userMap.get(d.userId);
    return {
      ...d,
      name: u?.name || "Driver",
      phone: u?.phone || null,
      email: u?.email || null,
    };
  });
  res.json({ success: true, message: "Nearby available drivers fetched successfully.", data: enriched });
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

export async function getAdminStats(_req: Request, res: Response): Promise<void> {
  const stats = await adminService.getAdminStats();
  res.json({ success: true, message: "Admin overview stats fetched successfully.", data: stats });
}

export async function listCustomers(req: Request, res: Response): Promise<void> {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const search = req.query.search ? String(req.query.search) : undefined;
  const result = await adminService.listCustomers({ page, limit, search });
  res.json({ success: true, message: "Customers fetched successfully.", data: result });
}

export async function listAllDrivers(req: Request, res: Response): Promise<void> {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const status = req.query.status ? String(req.query.status) : undefined;
  const search = req.query.search ? String(req.query.search) : undefined;
  const result = await adminService.listAllDrivers({ page, limit, status, search });
  res.json({ success: true, message: "Drivers list fetched successfully.", data: result });
}

export async function listReviews(_req: Request, res: Response): Promise<void> {
  const reviews = await adminService.listReviews();
  res.json({ success: true, message: "Reviews and ratings fetched successfully.", data: reviews });
}

export async function getDriverDetails(req: Request, res: Response): Promise<void> {
  const { driverId } = driverParamsSchema.parse(req.params);
  const details = await adminService.getDriverDetails(driverId);
  res.json({ success: true, message: "Driver details fetched successfully.", data: details });
}

export async function deleteDriverProfile(req: Request, res: Response): Promise<void> {
  const { driverId } = driverParamsSchema.parse(req.params);
  await adminService.deleteDriverProfile(driverId);
  res.json({ success: true, message: "Driver profile deleted successfully." });
}

export async function updateDriverProfile(req: Request, res: Response): Promise<void> {
  const { driverId } = driverParamsSchema.parse(req.params);
  const body = req.body ?? {};
  if (body.vehicleImage !== undefined) {
    body.vehicleImage = await saveImageAndGetLink(body.vehicleImage, req, "vehicle");
  }
  if (body.profileImage !== undefined) {
    body.profileImage = await saveImageAndGetLink(body.profileImage, req, "profile");
  }
  const updated = await adminService.updateDriverProfile(driverId, body);
  res.json({ success: true, message: "Driver profile updated successfully.", data: updated });
}

export async function submitDriverDocument(req: Request, res: Response): Promise<void> {
  const { driverId } = driverParamsSchema.parse(req.params);
  const { DriverProfile } = await import("../models/DriverProfile.js");
  const { DriverDocument } = await import("../models/DriverDocument.js");
  const { AppError } = await import("../utils/AppError.js");

  let profile = await DriverProfile.findById(driverId);
  if (!profile) profile = await DriverProfile.findOne({ userId: driverId });
  if (!profile) throw new AppError(404, "Driver profile not found.");

  const { documentType, documentNumber, documentUrl, verificationStatus = "VERIFIED" } = req.body ?? {};
  if (!documentType || !documentNumber || !documentUrl) {
    throw new AppError(400, "documentType, documentNumber, and documentUrl are required.");
  }

  const cleanNumber = String(documentNumber).replace(/[\s-]/g, "").toUpperCase();
  const savedUrl = (await saveImageAndGetLink(documentUrl, req, "doc")) || documentUrl;

  const doc = await DriverDocument.findOneAndUpdate(
    { driverId: profile._id, documentType },
    {
      $set: {
        documentNumber: cleanNumber,
        documentUrl: savedUrl,
        verificationStatus,
        verifiedAt: verificationStatus === "VERIFIED" ? new Date() : undefined,
      },
      $unset: { rejectionReason: "" },
    },
    { upsert: true, returnDocument: "after" }
  );

  res.status(201).json({
    success: true,
    message: `Driver document (${documentType}) saved successfully.`,
    data: doc.toJSON(),
  });
}

export async function deleteDriverDocument(req: Request, res: Response): Promise<void> {
  const { driverId } = driverParamsSchema.parse(req.params);
  const { documentId } = req.params;
  const { DriverDocument } = await import("../models/DriverDocument.js");
  await DriverDocument.deleteOne({ _id: documentId });
  res.json({ success: true, message: "Driver document deleted successfully." });
}

export async function updateDriverDocumentStatus(req: Request, res: Response): Promise<void> {
  const { driverId } = driverParamsSchema.parse(req.params);
  const { documentId } = req.params;
  const { verificationStatus, rejectionReason } = req.body ?? {};
  const { DriverDocument } = await import("../models/DriverDocument.js");
  const doc = await DriverDocument.findByIdAndUpdate(
    documentId,
    {
      $set: {
        verificationStatus,
        verifiedAt: verificationStatus === "VERIFIED" ? new Date() : undefined,
        rejectionReason: verificationStatus === "REJECTED" ? rejectionReason : undefined,
      },
    },
    { new: true }
  );
  res.json({
    success: true,
    message: `Document status updated to ${verificationStatus}.`,
    data: doc ? doc.toJSON() : null,
  });
}

const suspendSchema = z.object({
  reason: z.string().trim().min(5, "Reason must be at least 5 characters").max(500),
});

export async function suspendDriver(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { driverId } = driverParamsSchema.parse(req.params);
  const { reason } = suspendSchema.parse(req.body ?? {});
  const driver = await adminService.suspendDriver(userId, driverId, reason);
  res.json({ success: true, message: "Driver suspended.", data: driver });
}

export async function activateDriver(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { driverId } = driverParamsSchema.parse(req.params);
  const driver = await adminService.activateDriver(userId, driverId);
  res.json({ success: true, message: "Driver activated.", data: driver });
}

export async function listAllRides(req: Request, res: Response): Promise<void> {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const status = req.query.status ? String(req.query.status) : undefined;
  const result = await adminService.listAllRides({ page, limit, status });
  res.json({ success: true, message: "Rides fetched successfully.", data: result });
}

export async function listActiveRides(req: Request, res: Response): Promise<void> {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await adminService.listActiveRides({ page, limit });
  res.json({ success: true, message: "Active rides fetched successfully.", data: result });
}

export async function listAllPayments(req: Request, res: Response): Promise<void> {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const status = req.query.status ? String(req.query.status) : undefined;
  const result = await adminService.listAllPayments({ page, limit, status });
  res.json({ success: true, message: "Payments fetched successfully.", data: result });
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  const from = req.query.from ? String(req.query.from) : undefined;
  const to = req.query.to ? String(req.query.to) : undefined;
  const result = await adminService.getAnalytics({ from, to });
  res.json({ success: true, message: "Analytics fetched successfully.", data: result });
}

export async function listAuditLogs(req: Request, res: Response): Promise<void> {
  const page = req.query.page ? Number(req.query.page) : 1;
  const limit = req.query.limit ? Number(req.query.limit) : 20;
  const result = await adminService.listAuditLogs({ page, limit });
  res.json({ success: true, message: "Audit logs fetched successfully.", data: result });
}

