import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { GENDERS, VERIFICATION_STATUSES, cleanJSON } from "./shared.js";

export const AVAILABILITY_STATUSES = ["OFFLINE", "AVAILABLE", "BUSY"] as const;
export type AvailabilityStatus = (typeof AVAILABILITY_STATUSES)[number];

// GeoJSON Point. Coordinate order is [longitude, latitude] (x, y), not lat/lng.
const pointSchema = new Schema(
  {
    type: { type: String, enum: ["Point"], required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: ([lng, lat, ...rest]: number[]) =>
          rest.length === 0 && lng! >= -180 && lng! <= 180 && lat! >= -90 && lat! <= 90,
        message: "coordinates must be [longitude, latitude]",
      },
    },
  },
  { _id: false },
);

const driverProfileSchema = new Schema(
  {
    // Unique: one profile per driver, and the lookup key for every request.
    userId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    profileImage: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDERS },
    // Unique: the same licence can't back two driver accounts.
    licenseNumber: { type: String, required: true, unique: true },

    // ---- Admin-controlled. No driver-facing endpoint can write these. ----
    verificationStatus: { type: String, enum: VERIFICATION_STATUSES, required: true, default: "PENDING" },
    verifiedAt: { type: Date },
    reviewedBy: { type: Types.ObjectId, ref: "User" }, // audit: which admin verified or rejected
    rejectionReason: { type: String },

    // ---- Availability & location (driverLocation.service.ts) ----
    // OFFLINE/AVAILABLE are set by the driver; BUSY will be set by the Ride module.
    availabilityStatus: { type: String, enum: AVAILABILITY_STATUSES, required: true, default: "OFFLINE" },
    // Current position only (no history). Removed when the driver goes OFFLINE.
    // `default: undefined` matters: an empty `{}` would break the 2dsphere index.
    location: { type: pointSchema, default: undefined },
    lastLocationUpdatedAt: { type: Date },
  },
  { timestamps: true, toJSON: cleanJSON },
);

// Admin queue: "PENDING drivers, oldest first" without scanning the collection.
driverProfileSchema.index({ verificationStatus: 1, createdAt: 1 });

// Nearby-driver search ($geoNear). 2dsphere indexes are sparse: profiles with
// no location (offline drivers) aren't in the index at all, so it only holds
// drivers currently sharing their location.
driverProfileSchema.index({ location: "2dsphere" });

export type DriverProfileDocument = HydratedDocument<InferSchemaType<typeof driverProfileSchema>>;

export const DriverProfile = model("DriverProfile", driverProfileSchema);
