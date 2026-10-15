import { Types } from "mongoose";
import { env } from "../config/env.js";
import { Ride, type RideDocument } from "../models/Ride.js";
import { findNearbyAvailableDrivers, type NearbyDriver } from "./driverLocation.service.js";

// Decides WHICH drivers get offered a ride. It never assigns anyone: a driver
// becomes assigned only by accepting (ride.service.acceptRide), atomically.

/** Upper bound on search rounds per ride; no infinite retries. */
export const MAX_MATCHING_ATTEMPTS = 10;
/** Minimum gap between search rounds for the same ride. */
export const MATCHING_RETRY_INTERVAL_MS = 15_000;

/**
 * Orders candidates, best first. Today: nearest first. This is the single
 * place to evolve matching, e.g. a weighted score:
 *   score = w1·distance + w2·(5 − rating) + w3·(1 − acceptanceRate) + w4·todaysTrips
 * Callers don't change when the formula does.
 */
export function rankCandidates(candidates: NearbyDriver[]): NearbyDriver[] {
  return [...candidates].sort((a, b) => a.distanceMeters - b.distanceMeters);
}

/**
 * One search round: finds AVAILABLE + VERIFIED drivers of the ride's vehicle
 * type with a fresh location near the pickup (Step 3), skips drivers already
 * offered or who rejected, and offers the ride to the best MATCHING_BATCH_SIZE.
 *
 * "Offering" = adding them to ride.offeredDriverIds. They see it via
 * GET /api/drivers/rides/requests today; Step 5 will also push it via Socket.IO.
 *
 * Returns the updated ride, or null if the ride stopped SEARCHING meanwhile.
 */
export async function offerRideToNearbyDrivers(ride: RideDocument): Promise<RideDocument | null> {
  const matchAll = env.rides.matchAllDrivers;
  // Match-all mode offers the ride to every eligible driver of this vehicle
  // type at once, ignoring distance; the vehicle type is always enforced.
  const batchSize = matchAll ? 100 : env.rides.matchingBatchSize;
  const alreadyContacted = new Set([...ride.offeredDriverIds, ...ride.rejectedDriverIds].map(String));

  const candidates = await findNearbyAvailableDrivers({
    latitude: ride.pickup.latitude,
    longitude: ride.pickup.longitude,
    vehicleType: ride.vehicleType,
    matchAll,
    limit: batchSize + alreadyContacted.size,
  });
  const picked = rankCandidates(candidates.filter((c) => !alreadyContacted.has(c.driverId))).slice(0, batchSize);

  // Conditional on SEARCHING: never offer a ride that was just accepted or cancelled.
  return Ride.findOneAndUpdate(
    { _id: ride._id, status: "SEARCHING" },
    {
      $addToSet: { offeredDriverIds: { $each: picked.map((c) => new Types.ObjectId(c.driverId)) } },
      $inc: { matchingAttempts: 1 },
      $set: { lastMatchedAt: new Date() },
    },
    { returnDocument: "after" },
  );
}
