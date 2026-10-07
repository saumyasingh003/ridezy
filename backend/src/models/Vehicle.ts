import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { cleanJSON } from "./shared.js";

export const VEHICLE_TYPES = ["BIKE", "AUTO", "CAB"] as const;

const vehicleSchema = new Schema(
  {
    // Unique: one active vehicle per driver for the MVP. Dropping this index
    // (and adding an `isActive` flag) is all it takes to allow several later.
    driverId: { type: Types.ObjectId, ref: "DriverProfile", required: true, unique: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },
    make: { type: String, required: true, trim: true },
    model: { type: String, required: true, trim: true },
    year: { type: Number, required: true },
    color: { type: String, required: true, trim: true },
    // Stored normalised ("BR01AB1234"), so the unique index can't be dodged with spaces.
    registrationNumber: { type: String, required: true, unique: true },
    vehicleImage: { type: String },
  },
  { timestamps: true, toJSON: cleanJSON },
);

export type VehicleDocument = HydratedDocument<InferSchemaType<typeof vehicleSchema>>;

export const Vehicle = model("Vehicle", vehicleSchema);
