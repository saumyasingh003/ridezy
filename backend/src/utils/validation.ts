import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { GENDERS } from "../models/shared.js";

// Reusable Zod rules shared by every module. Module-specific request schemas
// live next to the controller that uses them.

/**
 * Accepts "+91 98765-43210", "+919876543210" or a plain 10-digit Indian mobile
 * ("9876543210", assumed +91). Always produces E.164, e.g. "+919876543210",
 * so the same number can't be stored in two spellings.
 */
export const phoneSchema = z
  .string({ error: "Phone number is required" })
  .transform((value) => value.replace(/[\s\-().]/g, ""))
  .transform((value) => (/^[6-9]\d{9}$/.test(value) ? `+91${value}` : value))
  .pipe(z.string().regex(/^\+[1-9]\d{7,14}$/, "Enter a valid phone number, e.g. 9876543210 or +919876543210"));

/** "YYYY-MM-DD" in the past, optionally with a minimum age. */
export function dateOfBirthSchema(minAge = 0) {
  return z.iso
    .date("Date of birth must be in YYYY-MM-DD format")
    .transform((value) => new Date(`${value}T00:00:00.000Z`))
    .refine((date) => date.getUTCFullYear() >= 1900, "Enter a real date of birth")
    .refine((date) => {
      const latest = new Date();
      latest.setUTCFullYear(latest.getUTCFullYear() - minAge);
      return date <= latest;
    }, minAge > 0 ? `You must be at least ${minAge} years old` : "Date of birth can't be in the future");
}

export const genderSchema = z.enum(GENDERS, { error: `Gender must be one of ${GENDERS.join(", ")}` });

/** http(s) URL only: blocks javascript:, data: and other schemes. */
export const urlSchema = z
  .string()
  .trim()
  .max(2048, "URL is too long")
  .pipe(z.url({ protocol: /^https?$/, error: "Must be a valid http(s) URL" }));

/** A MongoDB ObjectId in a URL parameter, e.g. /saved-places/:placeId. */
export const objectIdSchema = z.string().refine((value) => isValidObjectId(value), "Invalid id");

/** Upper-cases and strips spaces/dashes: "br 01 ab-1234" → "BR01AB1234". */
export function codeSchema(label: string, min: number, max: number) {
  return z
    .string({ error: `${label} is required` })
    .transform((value) => value.replace(/[\s-]/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters`)
        .max(max, `${label} must be at most ${max} characters`)
        .regex(/^[A-Z0-9/]+$/, `${label} may only contain letters and numbers`),
    );
}

/** Rejects an empty PATCH body like `{}`, which would otherwise be a silent no-op. */
export function nonEmpty<T extends z.ZodObject>(schema: T) {
  return schema.refine((value) => Object.values(value).some((v) => v !== undefined), {
    message: "Provide at least one field to update",
  });
}

export const latitudeSchema = z
  .number({ error: "Latitude is required and must be a number" })
  .min(-90, "Latitude must be between -90 and 90")
  .max(90, "Latitude must be between -90 and 90");

export const longitudeSchema = z
  .number({ error: "Longitude is required and must be a number" })
  .min(-180, "Longitude must be between -180 and 180")
  .max(180, "Longitude must be between -180 and 180");

/** Both required together. */
export const coordinatesSchema = z.object({ latitude: latitudeSchema, longitude: longitudeSchema });

/** A place picked by the user: what to show (address) plus where it is. */
export const placeSchema = z.object({
  address: z.string({ error: "Address is required" }).trim().min(3, "Address is too short").max(300),
  latitude: latitudeSchema,
  longitude: longitudeSchema,
});
