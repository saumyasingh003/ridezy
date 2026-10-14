import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { VEHICLE_TYPES } from "./Vehicle.js";
import { DRIVER_TIP_OPTIONS } from "./Payment.js";
import { cleanJSON } from "./shared.js";

/* ------------------------------- State machine ------------------------------ */

export const RIDE_STATUSES = [
  "SEARCHING",
  "DRIVER_ASSIGNED",
  "DRIVER_ARRIVING",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "RIDE_COMPLETED",
  "CANCELLED",
] as const;
export type RideStatus = (typeof RIDE_STATUSES)[number];

/** Every legal move. Anything not listed (e.g. SEARCHING → RIDE_COMPLETED) is refused. */
export const RIDE_TRANSITIONS: Record<RideStatus, readonly RideStatus[]> = {
  SEARCHING: ["DRIVER_ASSIGNED", "CANCELLED"],
  DRIVER_ASSIGNED: ["DRIVER_ARRIVING", "DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVING: ["DRIVER_ARRIVED", "CANCELLED"],
  DRIVER_ARRIVED: ["RIDE_STARTED", "CANCELLED"],
  RIDE_STARTED: ["RIDE_COMPLETED"],
  RIDE_COMPLETED: [],
  CANCELLED: [],
};

export function canTransition(from: RideStatus, to: RideStatus): boolean {
  return RIDE_TRANSITIONS[from].includes(to);
}

/**
 * Statuses allowed to move to `to`. Used as the WHERE clause of every status
 * update (`status: { $in: statusesThatCanBecome("CANCELLED") }`), so the rule
 * is enforced atomically by the database write, not by an earlier read.
 */
export function statusesThatCanBecome(to: RideStatus): RideStatus[] {
  return RIDE_STATUSES.filter((from) => canTransition(from, to));
}

/** A ride that still occupies the passenger (they can't book another). */
export const ACTIVE_RIDE_STATUSES = RIDE_STATUSES.filter((s) => s !== "RIDE_COMPLETED" && s !== "CANCELLED");
/** A ride that occupies its assigned driver. */
export const DRIVER_ACTIVE_STATUSES = ACTIVE_RIDE_STATUSES.filter((s) => s !== "SEARCHING");

export const CANCELLED_BY = ["PASSENGER", "DRIVER", "SYSTEM"] as const;

/* ---------------------------------- Schema --------------------------------- */

// Pickup/destination are fixed facts of the trip, read with the ride, never
// searched by proximity: plain lat/lng, no GeoJSON or geo index needed.
const placeSchema = new Schema(
  {
    address: { type: String, required: true, trim: true },
    latitude: { type: Number, required: true, min: -90, max: 90 },
    longitude: { type: Number, required: true, min: -180, max: 180 },
  },
  { _id: false },
);

const rideSchema = new Schema(
  {
    passengerId: { type: Types.ObjectId, ref: "User", required: true },
    // DriverProfile id of the driver who accepted. Step 5 tracks exactly this driver.
    assignedDriverId: { type: Types.ObjectId, ref: "DriverProfile" },

    pickup: { type: placeSchema, required: true },
    destination: { type: placeSchema, required: true },
    vehicleType: { type: String, enum: VEHICLE_TYPES, required: true },

    // Server-calculated at booking time; never taken from the client.
    distanceKm: { type: Number, required: true, min: 0 },
    estimatedDurationMinutes: { type: Number, required: true, min: 0 },
    estimatedFare: { type: Number, required: true, min: 0 },
    routeSource: { type: String, enum: ["OSRM", "ESTIMATED"], required: true },

    status: { type: String, enum: RIDE_STATUSES, required: true, default: "SEARCHING" },

    // ---- Matching state (internal; never shown to the passenger) ----
    offeredDriverIds: { type: [{ type: Types.ObjectId, ref: "DriverProfile" }], default: [] },
    rejectedDriverIds: { type: [{ type: Types.ObjectId, ref: "DriverProfile" }], default: [] },
    matchingAttempts: { type: Number, required: true, default: 0 },
    lastMatchedAt: { type: Date },

    assignedAt: { type: Date },
    arrivedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    // Upfront pricing: the fare quoted at booking is what is charged.
    finalFare: { type: Number, min: 0 },
    // Tip the passenger offered while booking/riding (shown to drivers in offers).
    // It becomes the payment's default tip; the passenger can still change it when paying.
    tipAmount: { type: Number, enum: DRIVER_TIP_OPTIONS, default: 0 },

    // Ride OTP: created on accept, shown only to the passenger, required to
    // start the ride (proves the right passenger is in the vehicle). Short-lived
    // and attempt-limited, so it is stored as-is rather than hashed.
    startOtp: { type: String },
    startOtpAttempts: { type: Number, default: 0 },

    // Written in the same transaction as every chat message, so a message and
    // a concurrent complete/cancel conflict on this document and MongoDB
    // serialises them: no message can be saved after the ride has ended.
    lastMessageAt: { type: Date },

    cancelledAt: { type: Date },
    cancelledBy: { type: String, enum: CANCELLED_BY },
    cancellationReason: { type: String },
  },
  { timestamps: true, toJSON: cleanJSON }, // createdAt doubles as "requestedAt"
);

/*
 * At most ONE active ride per passenger, enforced by MongoDB itself: a second
 * concurrent booking fails with a duplicate-key error instead of slipping past
 * an application-level check. Also serves GET /rides/current.
 */
rideSchema.index(
  { passengerId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: ACTIVE_RIDE_STATUSES } }, name: "one_active_ride_per_passenger" },
);

/*
 * At most ONE active assigned ride per driver: the database-level backstop
 * behind the BUSY flag. Also serves "the driver's current ride".
 */
rideSchema.index(
  { assignedDriverId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: DRIVER_ACTIVE_STATUSES } }, name: "one_active_ride_per_driver" },
);

/*
 * Driver's pending offers: { status: SEARCHING, offeredDriverIds: me }.
 * Multikey (one entry per offered driver), and partial so only searching rides
 * are indexed: finished rides never bloat it.
 */
rideSchema.index(
  { offeredDriverIds: 1 },
  { partialFilterExpression: { status: "SEARCHING" }, name: "open_offers_by_driver" },
);

export type RideDocument = HydratedDocument<InferSchemaType<typeof rideSchema>>;

export const Ride = model("Ride", rideSchema);
