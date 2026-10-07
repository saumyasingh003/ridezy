import type { Request, Response } from "express";
import { z } from "zod";
import * as passengerService from "../services/passenger.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { SAVED_PLACE_TYPES } from "../models/PassengerProfile.js";
import { dateOfBirthSchema, genderSchema, nonEmpty, objectIdSchema, phoneSchema, urlSchema } from "../utils/validation.js";

/* -------------------------------- Validation -------------------------------- */

// Only these fields can be written by a passenger. Anything else in the body
// (userId, savedPlaces, ...) is stripped by Zod. `null` clears an optional field.
const profileFields = {
  phone: phoneSchema.optional(),
  profileImage: urlSchema.nullable().optional(),
  dateOfBirth: dateOfBirthSchema().nullable().optional(),
  gender: genderSchema.nullable().optional(),
};

const createProfileSchema = z.object(profileFields);
const updateProfileSchema = nonEmpty(z.object(profileFields));

const savedPlaceFields = {
  type: z.enum(SAVED_PLACE_TYPES, { error: "Type must be HOME, WORK or OTHER" }),
  label: z.string().trim().min(1, "Label is required").max(50),
  address: z.string().trim().min(5, "Address is too short").max(300),
  latitude: z.number({ error: "Latitude must be a number" }).min(-90).max(90),
  longitude: z.number({ error: "Longitude must be a number" }).min(-180).max(180),
};

// Label is optional on create: defaults to "Home" / "Work" / "Other".
const addSavedPlaceSchema = z
  .object({ ...savedPlaceFields, label: savedPlaceFields.label.optional() })
  .transform((place) => ({ ...place, label: place.label ?? place.type[0] + place.type.slice(1).toLowerCase() }));
const updateSavedPlaceSchema = nonEmpty(z.object(savedPlaceFields).partial());
const placeParamsSchema = z.object({ placeId: objectIdSchema });

/* -------------------------------- Controllers ------------------------------- */

export async function createProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = createProfileSchema.parse(req.body ?? {});
  const profile = await passengerService.createProfile(userId, input);
  res.status(201).json({ success: true, message: "Passenger profile created successfully.", data: profile });
}

export async function getProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const profile = await passengerService.getProfile(userId);
  res.json({ success: true, message: "Passenger profile fetched successfully.", data: profile });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const input = updateProfileSchema.parse(req.body ?? {});
  const profile = await passengerService.updateProfile(userId, input);
  res.json({ success: true, message: "Profile updated successfully.", data: profile });
}

export async function deleteProfile(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  await passengerService.deleteProfile(userId);
  res.json({ success: true, message: "Passenger profile deleted successfully." });
}

export async function addSavedPlace(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const place = addSavedPlaceSchema.parse(req.body ?? {});
  const profile = await passengerService.addSavedPlace(userId, place);
  res.status(201).json({ success: true, message: "Saved place added successfully.", data: profile });
}

export async function updateSavedPlace(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { placeId } = placeParamsSchema.parse(req.params);
  const changes = updateSavedPlaceSchema.parse(req.body ?? {});
  const profile = await passengerService.updateSavedPlace(userId, placeId, changes);
  res.json({ success: true, message: "Saved place updated successfully.", data: profile });
}

export async function deleteSavedPlace(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { placeId } = placeParamsSchema.parse(req.params);
  const profile = await passengerService.deleteSavedPlace(userId, placeId);
  res.json({ success: true, message: "Saved place deleted successfully.", data: profile });
}
