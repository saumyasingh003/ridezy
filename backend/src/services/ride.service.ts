import mongoose, { type ClientSession } from "mongoose";
import { env } from "../config/env.js";
import { CURRENCY } from "../config/fare.js";
import {
  ACTIVE_RIDE_STATUSES,
  DRIVER_ACTIVE_STATUSES,
  Ride,
  statusesThatCanBecome,
  type RideDocument,
} from "../models/Ride.js";
import { DriverProfile } from "../models/DriverProfile.js";
import { Vehicle, type VEHICLE_TYPES } from "../models/Vehicle.js";
import { User } from "../models/User.js";
import type { Role } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { duplicateKeyField } from "../utils/mongo.js";
import { haversineKm } from "../utils/geo.js";
import { calculateRoute } from "./route.service.js";
import { calculateFare } from "./fare.service.js";
import {
  MATCHING_RETRY_INTERVAL_MS,
  MAX_MATCHING_ATTEMPTS,
  offerRideToNearbyDrivers,
} from "./driverMatching.service.js";

type VehicleType = (typeof VEHICLE_TYPES)[number];

export interface Place {
  address: string;
  latitude: number;
  longitude: number;
}

export interface RideRequestInput {
  pickup: Place;
  destination: Place;
  vehicleType: VehicleType;
}

export interface Viewer {
  userId: string;
  role: Role;
}

const MIN_TRIP_KM = 0.1;
const RIDE_NOT_FOUND = "Ride not found.";
const NO_DRIVERS = "No drivers are currently available. We'll keep searching.";

/* ================================ Estimate ================================= */

/**
 * Server-side quote: route + fare. Used by both /estimate and booking, so the
 * booked price is always computed here, never taken from the client.
 */
async function quote({ pickup, destination, vehicleType }: RideRequestInput) {
  const straightLineKm = haversineKm(pickup, destination);
  if (straightLineKm < MIN_TRIP_KM) {
    throw new AppError(400, "Pickup and destination are too close (less than 100 m apart).");
  }
  if (straightLineKm > env.rides.maxDistanceKm) {
    throw new AppError(400, `Rides are limited to ${env.rides.maxDistanceKm} km.`);
  }

  const route = await calculateRoute(pickup, destination);
  if (route.distanceKm > env.rides.maxDistanceKm) {
    throw new AppError(400, `Rides are limited to ${env.rides.maxDistanceKm} km.`);
  }
  const fare = calculateFare({ vehicleType, distanceKm: route.distanceKm });
  return { route, fare };
}

export async function estimateRide(input: RideRequestInput) {
  const { route, fare } = await quote(input);
  return {
    pickup: input.pickup,
    destination: input.destination,
    vehicleType: input.vehicleType,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    estimatedFare: fare.estimatedFare,
    currency: fare.currency,
    fareBreakdown: fare.breakdown,
    routeSource: route.source,
    routeGeometry: route.geometry,
  };
}

/* ================================== Views ================================== */

async function assignedDriverInfo(driverProfileId: unknown) {
  const profile = await DriverProfile.findById(driverProfileId, { userId: 1, profileImage: 1 });
  if (!profile) return null;
  const [user, vehicle] = await Promise.all([
    User.findById(profile.userId, { name: 1 }),
    Vehicle.findOne({ driverId: profile._id }),
  ]);
  // Public, ride-relevant fields only: no phone, licence, documents or live location.
  return {
    name: user?.name ?? "Driver",
    profileImage: profile.profileImage ?? null,
    rating: null, // ratings arrive in a later step
    vehicle: vehicle
      ? {
          vehicleType: vehicle.vehicleType,
          make: vehicle.make,
          model: vehicle.model,
          color: vehicle.color,
          registrationNumber: vehicle.registrationNumber,
        }
      : null,
  };
}

async function toRideView(ride: RideDocument, viewer: Viewer) {
  const json = ride.toJSON();
  const view: Record<string, unknown> = {
    id: ride.id as string,
    status: ride.status,
    pickup: json.pickup,
    destination: json.destination,
    vehicleType: ride.vehicleType,
    distanceKm: ride.distanceKm,
    estimatedDurationMinutes: ride.estimatedDurationMinutes,
    estimatedFare: ride.estimatedFare,
    currency: CURRENCY,
    routeSource: ride.routeSource,
    assignedAt: ride.assignedAt ?? null,
    cancelledAt: ride.cancelledAt ?? null,
    cancelledBy: ride.cancelledBy ?? null,
    cancellationReason: ride.cancellationReason ?? null,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    driver: ride.assignedDriverId ? await assignedDriverInfo(ride.assignedDriverId) : null,
  };

  if (viewer.role !== "PASSENGER") {
    const passenger = await User.findById(ride.passengerId, { name: 1 });
    view.passenger = { name: passenger?.name ?? "Passenger" };
  }
  if (viewer.role === "ADMIN") {
    view.matching = {
      offeredDriverIds: ride.offeredDriverIds.map(String),
      rejectedDriverIds: ride.rejectedDriverIds.map(String),
      matchingAttempts: ride.matchingAttempts,
    };
  }
  return view;
}

/* ============================ Search maintenance =========================== */

/**
 * Keeps a SEARCHING ride moving without background jobs. Runs when the ride is
 * read by its passenger:
 *  - searched longer than RIDE_SEARCH_TIMEOUT_SECONDS → CANCELLED by SYSTEM
 *    (never left hanging, never blocks the passenger's next booking)
 *  - otherwise, at most every 15 s and at most 10 rounds → offer to more drivers
 */
async function refreshSearch(ride: RideDocument): Promise<RideDocument> {
  if (ride.status !== "SEARCHING") return ride;
  const now = Date.now();

  if (ride.createdAt.getTime() < now - env.rides.searchTimeoutMs) {
    const expired = await Ride.findOneAndUpdate(
      { _id: ride._id, status: { $in: statusesThatCanBecome("CANCELLED") } },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: "SYSTEM",
          cancellationReason: "No driver accepted the ride in time.",
        },
      },
      { returnDocument: "after" },
    );
    return expired ?? (await Ride.findById(ride._id)) ?? ride;
  }

  const lastRound = ride.lastMatchedAt?.getTime() ?? 0;
  if (ride.matchingAttempts < MAX_MATCHING_ATTEMPTS && lastRound < now - MATCHING_RETRY_INTERVAL_MS) {
    return (await offerRideToNearbyDrivers(ride)) ?? (await Ride.findById(ride._id)) ?? ride;
  }
  return ride;
}

/* ================================= Booking ================================= */

export async function bookRide(passengerId: string, input: RideRequestInput) {
  // An old search that timed out must not block a new booking.
  const existing = await Ride.findOne({ passengerId, status: { $in: ACTIVE_RIDE_STATUSES } });
  if (existing && (await refreshSearch(existing)).status !== "CANCELLED") {
    throw new AppError(409, "You already have an active ride.");
  }

  const { route, fare } = await quote(input);

  let ride: RideDocument;
  try {
    ride = await Ride.create({
      passengerId,
      pickup: input.pickup,
      destination: input.destination,
      vehicleType: input.vehicleType,
      distanceKm: route.distanceKm,
      estimatedDurationMinutes: route.durationMinutes,
      estimatedFare: fare.estimatedFare,
      routeSource: route.source,
      status: "SEARCHING",
    });
  } catch (err) {
    // Two bookings raced; the partial unique index let only one through.
    if (duplicateKeyField(err) === "passengerId") throw new AppError(409, "You already have an active ride.");
    throw err;
  }

  const matched = (await offerRideToNearbyDrivers(ride)) ?? ride;
  const driversContacted = matched.offeredDriverIds.length;

  return {
    ride: await toRideView(matched, { userId: passengerId, role: "PASSENGER" }),
    driversContacted,
    message: driversContacted > 0 ? "Ride booked. Looking for a driver." : NO_DRIVERS,
  };
}

/* ============================== Reading rides ============================== */

/** Loads a ride the viewer may see. Anyone else gets 404, never 403 (no probing ride ids). */
async function findVisibleRide(viewer: Viewer, rideId: string): Promise<RideDocument> {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError(404, RIDE_NOT_FOUND);
  if (viewer.role === "ADMIN") return ride;
  if (viewer.role === "PASSENGER" && String(ride.passengerId) === viewer.userId) return ride;

  if (viewer.role === "DRIVER") {
    const profile = await DriverProfile.findOne({ userId: viewer.userId });
    const mine = profile && String(ride.assignedDriverId) === String(profile._id);
    const offeredToMe =
      profile && ride.status === "SEARCHING" && ride.offeredDriverIds.some((id) => String(id) === String(profile._id));
    if (mine || offeredToMe) return ride;
  }
  throw new AppError(404, RIDE_NOT_FOUND);
}

export async function getRide(viewer: Viewer, rideId: string) {
  let ride = await findVisibleRide(viewer, rideId);
  if (viewer.role === "PASSENGER") ride = await refreshSearch(ride);
  return toRideView(ride, viewer);
}

/** The passenger's active ride, or the driver's assigned active ride. */
export async function getCurrentRide(viewer: Viewer) {
  let ride: RideDocument | null;

  if (viewer.role === "DRIVER") {
    const profile = await DriverProfile.findOne({ userId: viewer.userId });
    ride = profile
      ? await Ride.findOne({ assignedDriverId: profile._id, status: { $in: DRIVER_ACTIVE_STATUSES } })
      : null;
  } else {
    ride = await Ride.findOne({ passengerId: viewer.userId, status: { $in: ACTIVE_RIDE_STATUSES } });
    if (ride) ride = await refreshSearch(ride);
    if (ride?.status === "CANCELLED") ride = null; // just timed out
  }

  if (!ride) throw new AppError(404, "You have no active ride.");
  return toRideView(ride, viewer);
}

/** Open offers for a driver (what Step 5 will push over Socket.IO). */
export async function listRideRequests(userId: string) {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, "Driver profile not found. Create one first.");
  if (profile.availabilityStatus !== "AVAILABLE") return [];

  const rides = await Ride.find({
    status: "SEARCHING",
    offeredDriverIds: profile._id,
    createdAt: { $gte: new Date(Date.now() - env.rides.searchTimeoutMs) },
  }).sort({ createdAt: 1 });

  const [lng, lat] = profile.location?.coordinates ?? [];
  return Promise.all(
    rides.map(async (ride) => ({
      ...(await toRideView(ride, { userId, role: "DRIVER" })),
      distanceToPickupKm:
        lat !== undefined && lng !== undefined
          ? Math.round(haversineKm({ latitude: lat, longitude: lng }, ride.pickup) * 10) / 10
          : null,
    })),
  );
}

/* ============================ Accept / reject ============================== */

/**
 * Accept = two state changes that must happen together:
 *   driver AVAILABLE → BUSY   and   ride SEARCHING → DRIVER_ASSIGNED
 *
 * Each is an atomic conditional update ("…WHERE it is still AVAILABLE /
 * still SEARCHING and offered to me"), and both run in one transaction, so
 * either both happen or neither does. If two drivers accept at once, MongoDB
 * serialises the writes to the ride: one matches, the other matches 0
 * documents (or hits a write conflict, is retried, and then matches 0) and
 * gets 409. A driver accepting two rides at once is stopped the same way by
 * the driver update, plus the one-active-ride-per-driver unique index.
 */
export async function acceptRide(userId: string, rideId: string) {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, "Driver profile not found. Create one first.");

  // Pre-checks give clear errors; the transaction below re-asserts what matters.
  const ride = await Ride.findById(rideId);
  const offeredToMe = ride?.offeredDriverIds.some((id) => id.equals(profile._id));
  if (!ride || (!offeredToMe && !ride.assignedDriverId?.equals(profile._id))) {
    throw new AppError(404, "Ride request not found.");
  }
  if (ride.assignedDriverId?.equals(profile._id)) throw new AppError(409, "You already accepted this ride.");
  if (ride.status !== "SEARCHING") throw new AppError(409, "This ride is no longer available.");
  if (ride.createdAt.getTime() < Date.now() - env.rides.searchTimeoutMs) {
    throw new AppError(409, "This ride request has expired.");
  }
  if (profile.verificationStatus !== "VERIFIED") throw new AppError(403, "Only verified drivers can accept rides.");
  if (profile.availabilityStatus === "BUSY") throw new AppError(409, "You already have an active ride.");
  if (profile.availabilityStatus !== "AVAILABLE") throw new AppError(409, "Go online (AVAILABLE) to accept rides.");

  const vehicle = await Vehicle.findOne({ driverId: profile._id });
  if (!vehicle || vehicle.vehicleType !== ride.vehicleType) {
    throw new AppError(403, `This ride needs a ${ride.vehicleType}; your vehicle doesn't match.`);
  }

  let assigned: RideDocument | null = null;
  try {
    await mongoose.connection.transaction(async (session: ClientSession) => {
      const driver = await DriverProfile.findOneAndUpdate(
        { _id: profile._id, availabilityStatus: "AVAILABLE", verificationStatus: "VERIFIED" },
        { $set: { availabilityStatus: "BUSY" } },
        { session, returnDocument: "after", timestamps: false },
      );
      if (!driver) throw new AppError(409, "You are no longer available to accept rides.");

      assigned = await Ride.findOneAndUpdate(
        {
          _id: ride._id,
          status: { $in: statusesThatCanBecome("DRIVER_ASSIGNED") },
          offeredDriverIds: profile._id,
          vehicleType: vehicle.vehicleType,
        },
        { $set: { status: "DRIVER_ASSIGNED", assignedDriverId: profile._id, assignedAt: new Date() } },
        { session, returnDocument: "after" },
      );
      if (!assigned) throw new AppError(409, "This ride has already been accepted by another driver.");
    });
  } catch (err) {
    if (duplicateKeyField(err) === "assignedDriverId") throw new AppError(409, "You already have an active ride.");
    throw err;
  }

  return toRideView(assigned!, { userId, role: "DRIVER" });
}

/** Decline an offer: ride stays SEARCHING, driver stays AVAILABLE, matching moves on. */
export async function rejectRide(userId: string, rideId: string) {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, "Driver profile not found. Create one first.");

  const ride = await Ride.findOneAndUpdate(
    { _id: rideId, status: "SEARCHING", offeredDriverIds: profile._id },
    { $pull: { offeredDriverIds: profile._id }, $addToSet: { rejectedDriverIds: profile._id } },
    { returnDocument: "after" },
  );
  if (!ride) throw new AppError(404, "Ride request not found.");

  // Everyone offered so far declined: try the next-nearest drivers (bounded).
  if (ride.offeredDriverIds.length === 0 && ride.matchingAttempts < MAX_MATCHING_ATTEMPTS) {
    await offerRideToNearbyDrivers(ride);
  }
}

/* ================================== Cancel ================================= */

/**
 * Passenger cancels while SEARCHING or after assignment (before the ride
 * starts). If a driver was assigned they go back to AVAILABLE, in the same
 * transaction, so a cancelled ride can never leave a driver stuck BUSY.
 */
export async function cancelRide(passengerId: string, rideId: string, reason?: string) {
  let cancelled: RideDocument | null = null;

  await mongoose.connection.transaction(async (session: ClientSession) => {
    cancelled = await Ride.findOneAndUpdate(
      { _id: rideId, passengerId, status: { $in: statusesThatCanBecome("CANCELLED") } },
      {
        $set: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: "PASSENGER",
          ...(reason ? { cancellationReason: reason } : {}),
        },
      },
      { session, returnDocument: "after" },
    );
    if (cancelled?.assignedDriverId) {
      await DriverProfile.updateOne(
        { _id: cancelled.assignedDriverId, availabilityStatus: "BUSY" },
        { $set: { availabilityStatus: "AVAILABLE" } },
        { session, timestamps: false },
      );
    }
  });

  if (!cancelled) {
    const ride = await Ride.findOne({ _id: rideId, passengerId }, { status: 1 });
    if (!ride) throw new AppError(404, RIDE_NOT_FOUND);
    if (ride.status === "CANCELLED") throw new AppError(409, "This ride is already cancelled.");
    if (ride.status === "RIDE_COMPLETED") throw new AppError(409, "This ride is already completed.");
    throw new AppError(409, "A ride that has started can't be cancelled.");
  }

  return toRideView(cancelled, { userId: passengerId, role: "PASSENGER" });
}
