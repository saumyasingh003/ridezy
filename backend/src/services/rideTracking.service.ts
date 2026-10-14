import { DRIVER_ACTIVE_STATUSES, Ride } from "../models/Ride.js";
import type { DriverProfileDocument } from "../models/DriverProfile.js";
import { haversineKm } from "../utils/geo.js";
import { emitToUsers } from "../realtime/io.js";
import { User } from "../models/User.js";
import { FALLBACK_SPEED_KMH, ROAD_FACTOR } from "./route.service.js";
import { notifications } from "./notification.service.js";

/*
 * Live tracking: when a driver on an active ride sends a new location, the
 * ride's passenger gets it immediately over Socket.IO ("ride:driver-location")
 * instead of waiting for the next GET /rides/:rideId/driver poll (which stays
 * as the fallback after a reconnect).
 */

/** Within this distance of the pickup the driver counts as "approaching". */
export const DRIVER_APPROACHING_METERS = 500;

export interface DriverLocationEvent {
  rideId: string;
  latitude: number;
  longitude: number;
  lastLocationUpdatedAt: Date;
  heading: "PICKUP" | "DESTINATION";
  distanceKm: number;
  etaMinutes: number;
}

/** Same rough, offline ETA as GET /rides/:rideId/driver. */
export function etaTo(here: { latitude: number; longitude: number }, target: { latitude: number; longitude: number }) {
  const straightKm = haversineKm(here, target);
  return {
    distanceKm: Math.round(straightKm * ROAD_FACTOR * 10) / 10,
    etaMinutes: Math.max(1, Math.round(((straightKm * ROAD_FACTOR) / FALLBACK_SPEED_KMH) * 60)),
  };
}

/** Call after a BUSY driver's location was saved. Never throws (runs in the background). */
export async function publishDriverLocation(profile: DriverProfileDocument): Promise<void> {
  const [longitude, latitude] = profile.location?.coordinates ?? [];
  if (latitude === undefined || longitude === undefined || !profile.lastLocationUpdatedAt) return;

  const ride = await Ride.findOne(
    { assignedDriverId: profile._id, status: { $in: DRIVER_ACTIVE_STATUSES } },
    { passengerId: 1, status: 1, pickup: 1, destination: 1 },
  );
  if (!ride) return;

  const beforePickup = ride.status !== "RIDE_STARTED";
  const here = { latitude, longitude };
  const event: DriverLocationEvent = {
    rideId: String(ride._id),
    latitude,
    longitude,
    lastLocationUpdatedAt: profile.lastLocationUpdatedAt,
    heading: beforePickup ? "PICKUP" : "DESTINATION",
    ...etaTo(here, beforePickup ? ride.pickup : ride.destination),
  };
  // Only the ride's passenger: the driver already knows where they are.
  emitToUsers([String(ride.passengerId)], "ride:driver-location", event);

  // Close to the pickup: DRIVER_ASSIGNED → DRIVER_ARRIVING, and tell the passenger.
  // The conditional update is the once-only guard: of all location updates
  // inside the radius, exactly one can move the status, and only that one notifies.
  if (ride.status === "DRIVER_ASSIGNED" && haversineKm(here, ride.pickup) * 1000 <= DRIVER_APPROACHING_METERS) {
    const moved = await Ride.updateOne({ _id: ride._id, status: "DRIVER_ASSIGNED" }, { $set: { status: "DRIVER_ARRIVING" } });
    if (moved.modifiedCount === 1) {
      const driver = await User.findById(profile.userId, { name: 1 });
      await notifications.driverApproaching(ride.passengerId, String(ride._id), driver?.name ?? "Your driver", event.etaMinutes);
    }
  }
}
