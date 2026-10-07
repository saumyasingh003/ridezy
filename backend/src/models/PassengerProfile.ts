import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { GENDERS, cleanJSON } from "./shared.js";

export const SAVED_PLACE_TYPES = ["HOME", "WORK", "OTHER"] as const;
export const MAX_SAVED_PLACES = 20;

// Embedded: small, bounded, always read together with the profile.
// Each subdocument gets its own _id, which is the :placeId in the API.
const savedPlaceSchema = new Schema(
  {
    type: { type: String, enum: SAVED_PLACE_TYPES, required: true },
    label: { type: String, required: true, trim: true, maxlength: 50 },
    address: { type: String, required: true, trim: true, maxlength: 300 },
    // Plain numbers for now; GeoJSON + a 2dsphere index arrive with the location module.
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { toJSON: cleanJSON },
);

const passengerProfileSchema = new Schema(
  {
    // Unique: one profile per passenger, and the lookup key for every request.
    userId: { type: Types.ObjectId, ref: "User", required: true, unique: true },
    profileImage: { type: String },
    dateOfBirth: { type: Date },
    gender: { type: String, enum: GENDERS },
    savedPlaces: { type: [savedPlaceSchema], default: [] },
  },
  { timestamps: true, toJSON: cleanJSON },
);

export type PassengerProfileDocument = HydratedDocument<InferSchemaType<typeof passengerProfileSchema>>;

export const PassengerProfile = model("PassengerProfile", passengerProfileSchema);
