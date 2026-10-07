import { env } from "../config/env.js";
import { DriverProfile, type DriverProfileDocument } from "../models/DriverProfile.js";
import { Vehicle, type VEHICLE_TYPES } from "../models/Vehicle.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

// Single source of truth for driver availability and location.
// REST controllers use it today; Socket.IO handlers (Step 5) and the Ride
// module (Step 4) will call the same functions.

export type SettableStatus = "AVAILABLE" | "OFFLINE";
type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface DriverLocationView {
  availabilityStatus: string;
  latitude: number | null;
  longitude: number | null;
  lastLocationUpdatedAt: Date | null;
  isLocationStale: boolean;
}

export interface NearbyDriver {
  driverId: string; // DriverProfile id
  userId: string;
  vehicleType: VehicleType;
  distanceMeters: number;
  latitude: number;
  longitude: number;
  lastLocationUpdatedAt: Date;
}

const NOT_FOUND = "Driver profile not found. Create one first.";

/* --------------------------------- Helpers --------------------------------- */

/** Oldest acceptable lastLocationUpdatedAt (now minus the configured window). */
function freshnessCutoff(): Date {
  return new Date(Date.now() - env.location.staleAfterMs);
}

export function isLocationFresh(updatedAt: Date | null | undefined): boolean {
  return Boolean(updatedAt && updatedAt >= freshnessCutoff());
}

/** Our API speaks {latitude, longitude}; GeoJSON stores [longitude, latitude]. */
function toPoint({ latitude, longitude }: Coordinates) {
  return { type: "Point" as const, coordinates: [longitude, latitude] as [number, number] };
}

function toView(profile: DriverProfileDocument): DriverLocationView {
  const [longitude, latitude] = profile.location?.coordinates ?? [];
  return {
    availabilityStatus: profile.availabilityStatus,
    latitude: latitude ?? null,
    longitude: longitude ?? null,
    lastLocationUpdatedAt: profile.lastLocationUpdatedAt ?? null,
    isLocationStale: !isLocationFresh(profile.lastLocationUpdatedAt),
  };
}

function assertValidCoordinates({ latitude, longitude }: Coordinates): void {
  const ok =
    Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
  if (!ok) throw new AppError(400, "Invalid coordinates.");
}

/* --------------------------------- Location -------------------------------- */

/**
 * Stores the driver's current position (no history). Only VERIFIED drivers
 * may share location: an unverified driver can't go online, so storing their
 * whereabouts would serve no purpose.
 *
 * `timestamps: false`: frequent location writes shouldn't bump the profile's
 * `updatedAt`, which tracks profile edits.
 */
export async function updateDriverLocation(userId: string, coords: Coordinates): Promise<DriverLocationView> {
  assertValidCoordinates(coords);

  const profile = await DriverProfile.findOneAndUpdate(
    { userId, verificationStatus: "VERIFIED" },
    { $set: { location: toPoint(coords), lastLocationUpdatedAt: new Date() } },
    { returnDocument: "after", timestamps: false },
  );

  if (!profile) {
    if (!(await DriverProfile.exists({ userId }))) throw new AppError(404, NOT_FOUND);
    throw new AppError(403, "Only verified drivers can share their location.");
  }
  return toView(profile);
}

export async function getDriverLocation(userId: string): Promise<DriverLocationView> {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, NOT_FOUND);
  if (!profile.location) throw new AppError(404, "No location shared yet. Send PATCH /api/drivers/location first.");
  return toView(profile);
}

/* ------------------------------- Availability ------------------------------ */

/**
 * Driver-initiated transitions only:
 *   OFFLINE  ⇄ AVAILABLE   (AVAILABLE needs: verified, vehicle, fresh location)
 *   BUSY     → anything    refused here; owned by the Ride module (Step 4)
 *   *        → BUSY        not settable by the driver (rejected by validation)
 */
export async function setAvailability(userId: string, status: SettableStatus): Promise<DriverLocationView> {
  return status === "AVAILABLE" ? goAvailable(userId) : goOffline(userId);
}

async function goAvailable(userId: string): Promise<DriverLocationView> {
  // The JWT proves who the caller is; re-check the account itself in case it
  // changed after the token was issued.
  const user = await User.findById(userId, { role: 1, isEmailVerified: 1 });
  if (!user) throw new AppError(401, "Authentication required.");
  if (user.role !== "DRIVER") throw new AppError(403, "You do not have permission to perform this action.");
  if (!user.isEmailVerified) throw new AppError(403, "Verify your email before going online.");

  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, NOT_FOUND);
  if (profile.availabilityStatus === "BUSY") {
    throw new AppError(409, "You are on a ride. Availability will update when the ride ends.");
  }
  if (profile.verificationStatus !== "VERIFIED") {
    throw new AppError(403, `Your driver account is ${profile.verificationStatus}. Only verified drivers can go online.`);
  }
  if (!(await Vehicle.exists({ driverId: profile._id }))) {
    throw new AppError(400, "Add a vehicle before going online.");
  }
  if (!profile.location) {
    throw new AppError(400, "Share your current location before going online.");
  }
  if (!isLocationFresh(profile.lastLocationUpdatedAt)) {
    throw new AppError(400, "Your location is out of date. Send a fresh location update before going online.");
  }

  // Re-assert the critical conditions in the update itself, so a concurrent
  // change (admin reset, ride assignment) can't slip in between check and write.
  const updated = await DriverProfile.findOneAndUpdate(
    {
      _id: profile._id,
      verificationStatus: "VERIFIED",
      availabilityStatus: { $in: ["OFFLINE", "AVAILABLE"] },
      lastLocationUpdatedAt: { $gte: freshnessCutoff() },
    },
    { $set: { availabilityStatus: "AVAILABLE" } },
    { returnDocument: "after", timestamps: false },
  );
  if (!updated) throw new AppError(409, "Your driver status just changed. Please try again.");
  return toView(updated);
}

/** Going OFFLINE also deletes the stored location: no reason to keep it. */
async function goOffline(userId: string): Promise<DriverLocationView> {
  const updated = await DriverProfile.findOneAndUpdate(
    { userId, availabilityStatus: { $ne: "BUSY" } },
    { $set: { availabilityStatus: "OFFLINE" }, $unset: { location: "", lastLocationUpdatedAt: "" } },
    { returnDocument: "after", timestamps: false },
  );

  if (!updated) {
    if (!(await DriverProfile.exists({ userId }))) throw new AppError(404, NOT_FOUND);
    throw new AppError(409, "You are on a ride. Availability will update when the ride ends.");
  }
  return toView(updated);
}

/* --------------------------- Nearby driver search -------------------------- */

/**
 * Candidates for a pickup point, nearest first. INTERNAL: for the Ride module
 * (Step 4) and admin tooling. It returns exact locations, so it must never be
 * wired to a passenger-facing endpoint.
 *
 * Only drivers that are AVAILABLE, VERIFIED, have a vehicle and a location
 * updated within LOCATION_STALE_AFTER_SECONDS. It does not pick, reserve or
 * notify anyone: matching is Step 4's job.
 */
export async function findNearbyAvailableDrivers(options: {
  latitude: number;
  longitude: number;
  radiusMeters?: number;
  limit?: number;
  vehicleType?: VehicleType;
}): Promise<NearbyDriver[]> {
  const { radiusMeters = env.location.nearbyRadiusMeters, limit = 20, vehicleType } = options;
  assertValidCoordinates(options);

  return DriverProfile.aggregate<NearbyDriver>([
    {
      // Must be the first stage. Walks the 2dsphere index outward from `near`,
      // applies `query` to each candidate, stops at maxDistance, and returns
      // documents sorted by distance with `distanceMeters` added.
      $geoNear: {
        near: toPoint(options),
        key: "location",
        distanceField: "distanceMeters",
        maxDistance: radiusMeters,
        spherical: true,
        query: {
          availabilityStatus: "AVAILABLE",
          verificationStatus: "VERIFIED",
          lastLocationUpdatedAt: { $gte: freshnessCutoff() },
        },
      },
    },
    // Attach the vehicle; drivers without one drop out at $unwind.
    { $lookup: { from: Vehicle.collection.name, localField: "_id", foreignField: "driverId", as: "vehicle" } },
    { $unwind: "$vehicle" },
    ...(vehicleType ? [{ $match: { "vehicle.vehicleType": vehicleType } }] : []),
    { $limit: limit },
    {
      $project: {
        _id: 0,
        driverId: { $toString: "$_id" },
        userId: { $toString: "$userId" },
        vehicleType: "$vehicle.vehicleType",
        distanceMeters: { $round: ["$distanceMeters", 0] },
        longitude: { $arrayElemAt: ["$location.coordinates", 0] },
        latitude: { $arrayElemAt: ["$location.coordinates", 1] },
        lastLocationUpdatedAt: 1,
      },
    },
  ]);
}
