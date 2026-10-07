import type { Request, Response } from "express";
import { z } from "zod";
import * as driverService from "../services/driver.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { VEHICLE_TYPES } from "../models/Vehicle.js";
import { DOCUMENT_TYPES, documentNumberError } from "../models/DriverDocument.js";
import {
  codeSchema,
  dateOfBirthSchema,
  genderSchema,
  nonEmpty,
  objectIdSchema,
  phoneSchema,
  urlSchema,
} from "../utils/validation.js";

/* -------------------------------- Validation -------------------------------- */

// Only these fields can be written by a driver. verificationStatus, verifiedAt,
// rejectionReason, availabilityStatus and userId are not listed, so Zod strips
// them: a driver can never mark themselves VERIFIED.
const profileFields = {
  phone: phoneSchema.optional(),
  profileImage: urlSchema.nullable().optional(),
  dateOfBirth: dateOfBirthSchema(18).nullable().optional(),
  gender: genderSchema.nullable().optional(),
  licenseNumber: codeSchema("License number", 8, 20),
};

const createProfileSchema = z.object(profileFields);
const updateProfileSchema = nonEmpty(z.object({ ...profileFields, licenseNumber: profileFields.licenseNumber.optional() }));

const currentYear = new Date().getFullYear();
const vehicleFields = {
  vehicleType: z.enum(VEHICLE_TYPES, { error: "Vehicle type must be BIKE, AUTO or CAB" }),
  make: z.string().trim().min(1, "Make is required").max(50),
  model: z.string().trim().min(1, "Model is required").max(50),
  year: z
    .number({ error: "Year must be a number" })
    .int()
    .min(1990, "Year must be 1990 or later")
    .max(currentYear + 1, `Year can't be after ${currentYear + 1}`),
  color: z.string().trim().min(2, "Color is required").max(30),
  registrationNumber: codeSchema("Registration number", 4, 12),
  vehicleImage: urlSchema.nullable().optional(),
};

const addVehicleSchema = z.object(vehicleFields);
const updateVehicleSchema = nonEmpty(z.object(vehicleFields).partial());

const documentFields = {
  documentType: z.enum(DOCUMENT_TYPES, { error: `Document type must be one of ${DOCUMENT_TYPES.join(", ")}` }),
  documentNumber: codeSchema("Document number", 4, 30),
  documentUrl: urlSchema,
};

// The number format depends on the type (e.g. Aadhaar = 12 digits).
const documentSchema = z.object(documentFields).superRefine((doc, ctx) => {
  const error = documentNumberError(doc.documentType, doc.documentNumber);
  if (error) ctx.addIssue({ code: "custom", path: ["documentNumber"], message: error });
});

// documentType is fixed once submitted; only the number and file can be replaced.
// The number's format is checked in the service, against the stored type.
const updateDocumentSchema = nonEmpty(
  z.object({ documentNumber: documentFields.documentNumber, documentUrl: documentFields.documentUrl }).partial(),
);
const documentParamsSchema = z.object({ documentId: objectIdSchema });

/* ------------------------------ Profile handlers ---------------------------- */

export async function createProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = createProfileSchema.parse(req.body ?? {});
  const profile = await driverService.createProfile(userId, input);
  res.status(201).json({ success: true, message: "Driver profile created successfully.", data: profile });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const profile = await driverService.getProfile(userId);
  res.json({ success: true, message: "Driver profile fetched successfully.", data: profile });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = updateProfileSchema.parse(req.body ?? {});
  const profile = await driverService.updateProfile(userId, input);
  res.json({ success: true, message: "Profile updated successfully.", data: profile });
}

/* ------------------------------ Vehicle handlers ---------------------------- */

export async function addVehicle(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = addVehicleSchema.parse(req.body ?? {});
  const vehicle = await driverService.addVehicle(userId, input);
  res.status(201).json({ success: true, message: "Vehicle added successfully.", data: vehicle });
}

export async function getVehicle(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const vehicle = await driverService.getVehicle(userId);
  res.json({ success: true, message: "Vehicle fetched successfully.", data: vehicle });
}

export async function updateVehicle(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const changes = updateVehicleSchema.parse(req.body ?? {});
  const vehicle = await driverService.updateVehicle(userId, changes);
  res.json({ success: true, message: "Vehicle updated successfully.", data: vehicle });
}

export async function deleteVehicle(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  await driverService.deleteVehicle(userId);
  res.json({ success: true, message: "Vehicle deleted successfully." });
}

/* ----------------------------- Document handlers ---------------------------- */

export async function submitDocument(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = documentSchema.parse(req.body ?? {});
  const document = await driverService.submitDocument(userId, input);
  res.status(201).json({ success: true, message: "Document submitted for verification.", data: document });
}

export async function listDocuments(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const documents = await driverService.listDocuments(userId);
  res.json({ success: true, message: "Documents fetched successfully.", data: documents });
}

export async function updateDocument(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { documentId } = documentParamsSchema.parse(req.params);
  const changes = updateDocumentSchema.parse(req.body ?? {});
  const document = await driverService.updateDocument(userId, documentId, changes);
  res.json({ success: true, message: "Document re-submitted for verification.", data: document });
}
