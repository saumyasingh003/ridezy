import { randomInt } from "node:crypto";
import mongoose, { type ClientSession } from "mongoose";
import { env } from "../config/env.js";
import { CURRENCY } from "../config/fare.js";
import {
  ACTIVE_RIDE_STATUSES,
  DRIVER_ACTIVE_STATUSES,
  Ride,
  statusesThatCanBecome,
  type RideDocument,
  type RideStatus,
} from "../models/Ride.js";
import { DriverProfile } from "../models/DriverProfile.js";
import { computePaymentAmounts, OPEN_PAYMENT_STATUSES, Payment, type DriverTip } from "../models/Payment.js";
import { breakdownOf } from "./payment.service.js";
import { Rating } from "../models/Rating.js";
import { ratingSummary } from "./rating.service.js";
import { inBackground, notifications } from "./notification.service.js";
import { closeRideCommunication } from "./rideCommunication.service.js";
import { etaTo } from "./rideTracking.service.js";
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
import { hasAllDocumentsVerified, isEligibleForRides } from "./driverLocation.service.js";

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
const MAX_OTP_ATTEMPTS = 5;
const OTP_VISIBLE_STATUSES: RideStatus[] = ["DRIVER_ASSIGNED", "DRIVER_ARRIVING", "DRIVER_ARRIVED"];
const RIDE_NOT_FOUND = "Ride not found.";
function noDriversMessage(vehicleType: string): string {
  const km = env.location.nearbyRadiusMeters / 1000;
  return `No ${vehicleType.toLowerCase()} drivers within ${km} km right now. We'll keep searching.`;
}

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
  const [user, vehicle, rating] = await Promise.all([
    User.findById(profile.userId, { name: 1 }),
    Vehicle.findOne({ driverId: profile._id }),
    ratingSummary(profile.userId),
  ]);
  // Public, ride-relevant fields only: no phone, licence, documents or live location.
  return {
    name: user?.name ?? "Driver",
    profileImage: profile.profileImage ?? null,
    rating: rating.average, // average of passengers' ratings; null until rated
    ratingCount: rating.count,
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
    arrivedAt: ride.arrivedAt ?? null,
    startedAt: ride.startedAt ?? null,
    completedAt: ride.completedAt ?? null,
    finalFare: ride.finalFare ?? null,
    tipAmount: ride.tipAmount ?? 0,
    cancelledAt: ride.cancelledAt ?? null,
    cancelledBy: ride.cancelledBy ?? null,
    cancellationReason: ride.cancellationReason ?? null,
    createdAt: ride.createdAt,
    updatedAt: ride.updatedAt,
    driver: ride.assignedDriverId ? await assignedDriverInfo(ride.assignedDriverId) : null,
  };

  // Completed rides carry their payment state, so both apps know whether to
  // ask for payment (passenger) or confirm cash (driver).
  if (ride.status === "RIDE_COMPLETED") {
    const payment = await Payment.findOne({ rideId: ride._id, status: { $in: OPEN_PAYMENT_STATUSES } });
    view.payment = payment
      ? {
          id: payment.id as string,
          status: payment.status,
          method: payment.method,
          amount: payment.amount,
          ...breakdownOf(payment),
        }
      : null;
    // The score the rider gave (null = not rated yet). Only riders rate.
    if (viewer.role === "PASSENGER") {
      const mine = await Rating.findOne({ rideId: ride._id, fromUserId: viewer.userId }, { score: 1 });
      view.myRating = mine?.score ?? null;
    }
  }

  // Only the passenger sees the OTP, and only until the ride starts: they read
  // it out to the driver, which is the proof they are in the right vehicle.
  if (viewer.role === "PASSENGER" && OTP_VISIBLE_STATUSES.includes(ride.status)) {
    view.startOtp = ride.startOtp ?? null;
  }
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

/** The driver's display name, for notification text. */
async function driverName(userId: string): Promise<string> {
  return (await User.findById(userId, { name: 1 }))?.name ?? "Your driver";
}

/* ============================ Search maintenance =========================== */

/**
 * Keeps a SEARCHING ride moving without background jobs. Runs when the ride is
 * read by its passenger:
 *  - searched longer than RIDE_SEARCH_TIMEOUT_SECONDS → CANCELLED by SYSTEM
 *    (never left hanging, never blocks the passenger's next booking)
 *  - otherwise, at most every 15 s and at most 10 rounds → offer to more drivers
 */
// Exported for tests (the search-timeout race is only reproducible with a stale ride).
export async function refreshSearch(ride: RideDocument): Promise<RideDocument> {
  if (ride.status !== "SEARCHING") return ride;
  const now = Date.now();

  if (ride.createdAt.getTime() < now - env.rides.searchTimeoutMs) {
    // Only a ride that is still SEARCHING may time out. (statusesThatCanBecome("CANCELLED")
    // would also match DRIVER_ASSIGNED and could cancel a ride a driver just accepted.)
    const expired = await Ride.findOneAndUpdate(
      { _id: ride._id, status: "SEARCHING" },
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
    if (expired) inBackground(() => notifications.noDriverFound(expired.passengerId, expired.id as string));
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
    message: driversContacted > 0 ? "Ride booked. Looking for a driver." : noDriversMessage(input.vehicleType),
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
  // Offers made earlier must disappear if the driver (or a document) is no longer verified.
  if (!(await isEligibleForRides(profile))) return [];

  // Offers follow the driver's CURRENT vehicle: if they switched from a bike
  // to a cab, the bike rides they were offered earlier disappear.
  const vehicle = await Vehicle.findOne({ driverId: profile._id }, { vehicleType: 1 });
  if (!vehicle) return [];

  const rides = await Ride.find({
    status: "SEARCHING",
    offeredDriverIds: profile._id,
    vehicleType: vehicle.vehicleType,
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
  if (!(await hasAllDocumentsVerified(profile))) {
    throw new AppError(403, "All your documents must be verified before you can accept rides.");
  }
  if (profile.availabilityStatus === "BUSY") throw new AppError(409, "You already have an active ride.");
  if (profile.availabilityStatus !== "AVAILABLE") throw new AppError(409, "Go online (AVAILABLE) to accept rides.");

  const vehicle = await Vehicle.findOne({ driverId: profile._id });
  if (!vehicle) throw new AppError(403, "Add a vehicle before accepting rides.");
  // The vehicle must match the booked type, in every matching mode.
  if (vehicle.vehicleType !== ride.vehicleType) {
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
        {
          $set: {
            status: "DRIVER_ASSIGNED",
            assignedDriverId: profile._id,
            assignedAt: new Date(),
            // crypto.randomInt, not Math.random: OTPs must be unpredictable.
            startOtp: String(randomInt(0, 10_000)).padStart(4, "0"),
            startOtpAttempts: 0,
          },
        },
        { session, returnDocument: "after" },
      );
      if (!assigned) throw new AppError(409, "This ride has already been accepted by another driver.");
    });
  } catch (err) {
    if (duplicateKeyField(err) === "assignedDriverId") throw new AppError(409, "You already have an active ride.");
    throw err;
  }

  const accepted = assigned as unknown as RideDocument;
  inBackground(() => driverName(userId).then((name) => notifications.rideAccepted(accepted.passengerId, accepted.id as string, name)));
  return toRideView(accepted, { userId, role: "DRIVER" });
}

/** Decline an offer: ride stays SEARCHING, driver stays AVAILABLE, matching moves on. */
export async function rejectRide(userId: string, rideId: string) {
  const profile = await DriverProfile.findOne({ $or: [{ userId }, { _id: userId }] });
  if (!profile) throw new AppError(404, "Driver profile not found. Create one first.");

  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError(404, "Ride request not found.");

  // If the ride is already accepted by another driver or cancelled, the offer is expired/gone
  if (ride.status !== "SEARCHING") {
    return { success: true, message: "Ride offer is no longer available." };
  }

  const updatedRide = await Ride.findOneAndUpdate(
    { _id: rideId, status: "SEARCHING" },
    { $pull: { offeredDriverIds: profile._id }, $addToSet: { rejectedDriverIds: profile._id } },
    { returnDocument: "after" },
  );

  // Everyone offered so far declined: try the next-nearest drivers (bounded).
  if (updatedRide && updatedRide.offeredDriverIds.length === 0 && updatedRide.matchingAttempts < MAX_MATCHING_ATTEMPTS) {
    await offerRideToNearbyDrivers(updatedRide);
  }

  return { success: true, message: "Ride request declined." };
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

  const done = cancelled as RideDocument;
  if (done.assignedDriverId) {
    inBackground(() =>
      DriverProfile.findById(done.assignedDriverId, { userId: 1 }).then((driver) => {
        closeRideCommunication(done.id as string, "RIDE_CANCELLED", [passengerId, ...(driver ? [String(driver.userId)] : [])]);
        if (driver) return notifications.rideCancelled(driver.userId, done.id as string);
      }),
    );
  }
  return toRideView(done, { userId: passengerId, role: "PASSENGER" });
}

/* ================================== Tip ==================================== */

/**
 * PATCH /api/rides/:rideId/tip: the passenger offers (or changes, or removes)
 * a driver tip while the ride is active, e.g. to attract a driver while
 * searching. It's added once to the final payment; after the ride ends the
 * tip is chosen on the payment screen instead.
 */
export async function setRideTip(passengerId: string, rideId: string, tip: DriverTip) {
  const updated = await Ride.findOneAndUpdate(
    { _id: rideId, passengerId, status: { $in: ACTIVE_RIDE_STATUSES } },
    { $set: { tipAmount: tip } },
    { returnDocument: "after", runValidators: true },
  );
  if (!updated) {
    const ride = await Ride.findOne({ _id: rideId, passengerId }, { status: 1 });
    if (!ride) throw new AppError(404, RIDE_NOT_FOUND);
    throw new AppError(409, "This ride has ended. Choose your tip when you pay.");
  }
  return toRideView(updated, { userId: passengerId, role: "PASSENGER" });
}

/* ============================= Trip lifecycle ============================== */
/*
 * Driver-driven moves after accept, each one atomic and conditional:
 *   DRIVER_ASSIGNED ─arrive─► DRIVER_ARRIVED ─start(OTP)─► RIDE_STARTED ─complete─► RIDE_COMPLETED
 * The WHERE clause re-checks "still assigned to me and still in a status that
 * may make this move", so a passenger cancelling at the same moment can't be
 * overwritten: one write matches, the other matches nothing and gets 409.
 */

/** The caller's driver profile and a ride assigned to them. Anyone else gets 404. */
async function findMyAssignedRide(userId: string, rideId: string) {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, "Driver profile not found. Create one first.");
  const ride = await Ride.findOne({ _id: rideId, assignedDriverId: profile._id });
  if (!ride) throw new AppError(404, RIDE_NOT_FOUND);
  return { profile, ride };
}

/** Clear 409 messages for a move the ride's current status doesn't allow. */
function wrongStatus(status: RideStatus, action: "arrive" | "start" | "complete"): AppError {
  if (status === "CANCELLED") return new AppError(409, "This ride was cancelled.");
  if (status === "RIDE_COMPLETED") return new AppError(409, "This ride is already completed.");
  if (action === "arrive") return new AppError(409, "You have already arrived for this ride.");
  if (action === "start") {
    return status === "RIDE_STARTED"
      ? new AppError(409, "This ride has already started.")
      : new AppError(409, "Mark yourself as arrived at the pickup point first.");
  }
  return new AppError(409, "Start the ride before completing it.");
}

/** POST /api/rides/:rideId/arrive: the driver is at the pickup point. */
export async function arriveAtPickup(userId: string, rideId: string) {
  const { profile, ride } = await findMyAssignedRide(userId, rideId);

  const updated = await Ride.findOneAndUpdate(
    { _id: ride._id, assignedDriverId: profile._id, status: { $in: statusesThatCanBecome("DRIVER_ARRIVED") } },
    { $set: { status: "DRIVER_ARRIVED", arrivedAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!updated) {
    const latest = await Ride.findById(ride._id, { status: 1 });
    throw wrongStatus((latest?.status ?? ride.status) as RideStatus, "arrive");
  }
  inBackground(() => driverName(userId).then((name) => notifications.driverArrived(updated.passengerId, updated.id as string, name)));
  return toRideView(updated, { userId, role: "DRIVER" });
}

/**
 * POST /api/rides/:rideId/start: needs the passenger's 4-digit OTP. Wrong
 * codes are counted atomically; after MAX_OTP_ATTEMPTS the ride can't be
 * started (the passenger can still cancel), which caps guessing at 5 of 10,000.
 */
export async function startRide(userId: string, rideId: string, otp: string) {
  const { profile, ride } = await findMyAssignedRide(userId, rideId);
  if (ride.status !== "DRIVER_ARRIVED") throw wrongStatus(ride.status as RideStatus, "start");
  if ((ride.startOtpAttempts ?? 0) >= MAX_OTP_ATTEMPTS) {
    throw new AppError(429, "Too many wrong codes. Ask the passenger to cancel and book again.");
  }

  if (!ride.startOtp || otp !== ride.startOtp) {
    const counted = await Ride.findOneAndUpdate(
      { _id: ride._id, status: "DRIVER_ARRIVED" },
      { $inc: { startOtpAttempts: 1 } },
      { returnDocument: "after" },
    );
    const left = Math.max(0, MAX_OTP_ATTEMPTS - (counted?.startOtpAttempts ?? MAX_OTP_ATTEMPTS));
    throw new AppError(
      400,
      left > 0
        ? `Incorrect ride OTP. ${left} ${left === 1 ? "attempt" : "attempts"} left.`
        : "Incorrect ride OTP. No attempts left.",
    );
  }

  const started = await Ride.findOneAndUpdate(
    {
      _id: ride._id,
      assignedDriverId: profile._id,
      status: { $in: statusesThatCanBecome("RIDE_STARTED") },
      startOtp: otp,
      startOtpAttempts: { $lt: MAX_OTP_ATTEMPTS },
    },
    { $set: { status: "RIDE_STARTED", startedAt: new Date() }, $unset: { startOtp: 1 } },
    { returnDocument: "after" },
  );
  if (!started) {
    const latest = await Ride.findById(ride._id, { status: 1 });
    throw wrongStatus((latest?.status ?? ride.status) as RideStatus, "start");
  }
  inBackground(() => notifications.rideStarted(started.passengerId, started.id as string));
  return toRideView(started, { userId, role: "DRIVER" });
}

/**
 * POST /api/rides/:rideId/complete: ride → RIDE_COMPLETED and driver BUSY →
 * AVAILABLE in one transaction, so a finished ride can never leave the driver
 * stuck BUSY (same reasoning as cancelRide).
 */
export async function completeRide(userId: string, rideId: string) {
  const { profile, ride } = await findMyAssignedRide(userId, rideId);
  if (ride.status !== "RIDE_STARTED") throw wrongStatus(ride.status as RideStatus, "complete");

  let completed: RideDocument | null = null;
  await mongoose.connection.transaction(async (session: ClientSession) => {
    completed = await Ride.findOneAndUpdate(
      { _id: ride._id, assignedDriverId: profile._id, status: { $in: statusesThatCanBecome("RIDE_COMPLETED") } },
      { $set: { status: "RIDE_COMPLETED", completedAt: new Date(), finalFare: ride.estimatedFare } },
      { session, returnDocument: "after" },
    );
    if (!completed) throw wrongStatus("RIDE_COMPLETED", "complete");

    await DriverProfile.updateOne(
      { _id: profile._id, availabilityStatus: "BUSY" },
      { $set: { availabilityStatus: "AVAILABLE" } },
      { session, timestamps: false },
    );

    const existingPayment = await Payment.findOne({ rideId: ride._id, status: { $in: OPEN_PAYMENT_STATUSES } }).session(session);
    if (!existingPayment) {
      await Payment.create(
        [
          {
            rideId: ride._id,
            passengerId: ride.passengerId,
            driverId: profile._id,
            // Cash by default, with the tip offered during the ride; the passenger can still change it or pay online.
            ...computePaymentAmounts(ride.estimatedFare, (completed as unknown as RideDocument).tipAmount as DriverTip),
            currency: CURRENCY,
            method: "CASH",
            status: "PENDING",
            provider: "CASH",
          },
        ],
        { session },
      );
    }
  });

  const finished = completed as unknown as RideDocument;
  closeRideCommunication(finished.id as string, "RIDE_COMPLETED", [String(finished.passengerId), userId]);
  inBackground(() => notifications.rideCompleted(finished.passengerId, finished.id as string, finished.finalFare ?? finished.estimatedFare));
  return toRideView(finished, { userId, role: "DRIVER" });
}

/* ================================= History ================================= */

export interface HistoryQuery {
  page: number;
  limit: number;
  status?: RideStatus;
}

/**
 * GET /api/rides/history: the passenger's rides, or the rides assigned to the
 * driver, newest first. Served by the { passengerId } / { assignedDriverId }
 * indexes.
 */
export async function listRideHistory(viewer: Viewer, { page, limit, status }: HistoryQuery) {
  const filter: Record<string, unknown> = {};
  if (viewer.role === "DRIVER") {
    const profile = await DriverProfile.findOne({ userId: viewer.userId }, { _id: 1 });
    if (!profile) return { rides: [], pagination: { page, limit, total: 0, pages: 0 } };
    filter.assignedDriverId = profile._id;
  } else {
    filter.passengerId = viewer.userId;
  }
  if (status) filter.status = status;

  const [total, rides] = await Promise.all([
    Ride.countDocuments(filter),
    Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
  ]);

  return {
    rides: await Promise.all(rides.map((ride) => toRideView(ride, viewer))),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}


/* ============================== Ride matching ============================== */

/** Minimum gap between manual "search again" requests for one ride. */
const MATCH_COOLDOWN_MS = 5_000;

/**
 * POST /api/rides/:rideId/match: the passenger asks to search again (e.g.
 * after "no drivers available"). Only while SEARCHING. Resets the round budget
 * (the automatic search stops after MAX_MATCHING_ATTEMPTS rounds) and runs a
 * round now. Drivers who declined stay excluded; the search timeout still
 * counts from booking, so a ride can't be kept searching forever.
 */
export async function restartMatching(passengerId: string, rideId: string) {
  let ride = await Ride.findOne({ _id: rideId, passengerId });
  if (!ride) throw new AppError(404, RIDE_NOT_FOUND);

  // Let an expired search time out first (it then answers 409 below).
  if (ride.status === "SEARCHING" && ride.createdAt.getTime() < Date.now() - env.rides.searchTimeoutMs) {
    ride = await refreshSearch(ride);
  }
  if (ride.status !== "SEARCHING") {
    throw new AppError(
      409,
      ride.status === "CANCELLED"
        ? "This ride is no longer searching. Please book a new ride."
        : "A driver has already accepted this ride.",
    );
  }
  if (ride.lastMatchedAt && Date.now() - ride.lastMatchedAt.getTime() < MATCH_COOLDOWN_MS) {
    throw new AppError(429, "Already searching. Try again in a few seconds.");
  }

  const before = ride.offeredDriverIds.length;
  const reset = await Ride.findOneAndUpdate(
    { _id: ride._id, status: "SEARCHING" },
    { $set: { matchingAttempts: 0 } },
    { returnDocument: "after" },
  );
  if (!reset) throw new AppError(409, "A driver has already accepted this ride.");

  const matched = (await offerRideToNearbyDrivers(reset)) ?? (await Ride.findById(ride._id)) ?? reset;
  const newlyContacted = Math.max(0, matched.offeredDriverIds.length - before);

  return {
    ride: await toRideView(matched, { userId: passengerId, role: "PASSENGER" }),
    driversContacted: matched.offeredDriverIds.length,
    newlyContacted,
    message: newlyContacted > 0 ? "Searching again. New drivers have been contacted." : noDriversMessage(matched.vehicleType),
  };
}

/**
 * GET /api/rides/:rideId/driver: the assigned driver's public details for the
 * ride's passenger, plus their live location only while the ride is active
 * (assigned → started). Never phone, licence or documents.
 */
export async function getAssignedDriver(passengerId: string, rideId: string) {
  const ride = await Ride.findOne({ _id: rideId, passengerId });
  if (!ride) throw new AppError(404, RIDE_NOT_FOUND);
  if (!ride.assignedDriverId) throw new AppError(404, "No driver has been assigned to this ride yet.");

  const info = await assignedDriverInfo(ride.assignedDriverId);
  if (!info) throw new AppError(404, "Driver not found.");

  let location = null;
  if ((DRIVER_ACTIVE_STATUSES as readonly string[]).includes(ride.status)) {
    const profile = await DriverProfile.findById(ride.assignedDriverId, { location: 1, lastLocationUpdatedAt: 1 });
    const [lng, lat] = profile?.location?.coordinates ?? [];
    if (lat !== undefined && lng !== undefined) {
      const here = { latitude: lat, longitude: lng };
      const beforePickup = ride.status !== "RIDE_STARTED";
      const target = beforePickup ? ride.pickup : ride.destination;
      location = {
        latitude: lat,
        longitude: lng,
        lastLocationUpdatedAt: profile!.lastLocationUpdatedAt ?? null,
        isLocationStale:
          !profile!.lastLocationUpdatedAt ||
          profile!.lastLocationUpdatedAt.getTime() < Date.now() - env.location.staleAfterMs,
        // Rough, offline estimate (same assumptions as the routing fallback).
        heading: beforePickup ? ("PICKUP" as const) : ("DESTINATION" as const),
        ...etaTo(here, target),
      };
    }
  }

  return { rideId: ride.id as string, rideStatus: ride.status, ...info, location };
}
