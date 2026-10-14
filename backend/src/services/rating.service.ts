import { Types } from "mongoose";
import { DriverProfile } from "../models/DriverProfile.js";
import { Payment } from "../models/Payment.js";
import { Rating, type RaterRole, type RatingDocument } from "../models/Rating.js";
import { Ride } from "../models/Ride.js";
import { User, type Role } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { duplicateKeyField } from "../utils/mongo.js";
import { inBackground, notifications } from "./notification.service.js";

// Post-ride ratings. Only the RIDER rates (the driver), and only once the ride
// is paid; after that there is no deadline. Drivers don't rate passengers.
// Averages are computed from the Rating collection (indexed by toUserId)
// rather than stored on profiles, so they can never drift.

export interface Viewer {
  userId: string;
  role: Role;
}

export interface RatingSummary {
  average: number | null; // rounded to 1 decimal; null when unrated
  count: number;
}

const RIDE_NOT_FOUND = "Ride not found.";

/**
 * The ratings that count: those riders gave (fromRole PASSENGER). Only riders
 * can rate now; this also ignores any older driver-to-passenger ratings, so
 * every average in the app (ride view, admin, /ratings/me) uses one rule.
 */
const FROM_RIDERS = { fromRole: "PASSENGER" as const };

function toRatingView(rating: RatingDocument) {
  return {
    id: rating.id as string,
    rideId: String(rating.rideId),
    fromRole: rating.fromRole,
    score: rating.score,
    comment: rating.comment ?? null,
    createdAt: rating.createdAt,
    updatedAt: rating.updatedAt,
  };
}

/**
 * Loads a ride and works out the caller's side of it. Anyone who isn't the
 * ride's passenger or assigned driver gets 404 (no probing ride ids).
 * Returns the caller's role on the ride and the other participant's User id.
 */
async function findRideForParticipant(viewer: Viewer, rideId: string) {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new AppError(404, RIDE_NOT_FOUND);

  if (viewer.role === "PASSENGER" && String(ride.passengerId) === viewer.userId) {
    const driver = ride.assignedDriverId ? await DriverProfile.findById(ride.assignedDriverId, { userId: 1 }) : null;
    return { ride, side: "PASSENGER" as RaterRole, otherUserId: driver ? String(driver.userId) : null };
  }
  if (viewer.role === "DRIVER" && ride.assignedDriverId) {
    const driver = await DriverProfile.findById(ride.assignedDriverId, { userId: 1 });
    if (driver && String(driver.userId) === viewer.userId) {
      return { ride, side: "DRIVER" as RaterRole, otherUserId: String(ride.passengerId) };
    }
  }
  throw new AppError(404, RIDE_NOT_FOUND);
}

/** POST /api/rides/:rideId/rating: the ride's rider rates the driver, once, any time after paying. */
export async function rateRide(viewer: Viewer, rideId: string, input: { score: number; comment?: string }) {
  if (viewer.role !== "PASSENGER") throw new AppError(403, "Only riders can rate a ride.");
  const { ride, side, otherUserId } = await findRideForParticipant(viewer, rideId);
  if (ride.status !== "RIDE_COMPLETED") throw new AppError(409, "You can rate a ride once it is completed.");
  if (!otherUserId) throw new AppError(409, "This ride has no driver to rate.");
  if (!(await Payment.exists({ rideId: ride._id, status: "COMPLETED" }))) {
    throw new AppError(409, "Pay for the ride before rating it.");
  }

  try {
    const rating = await Rating.create({
      rideId: ride._id,
      fromRole: side,
      fromUserId: viewer.userId,
      toUserId: otherUserId,
      score: input.score,
      ...(input.comment ? { comment: input.comment } : {}),
    });
    inBackground(() => notifications.newRating(otherUserId, String(ride._id), rating.score));
    return toRatingView(rating);
  } catch (err) {
    if (duplicateKeyField(err)) throw new AppError(409, "You have already rated this ride.");
    throw err;
  }
}

/** GET /api/rides/:rideId/rating: both sides' ratings, for the ride's participants or ADMIN. */
export async function getRideRatings(viewer: Viewer, rideId: string) {
  if (viewer.role === "ADMIN") {
    if (!(await Ride.exists({ _id: rideId }))) throw new AppError(404, RIDE_NOT_FOUND);
  } else {
    await findRideForParticipant(viewer, rideId);
  }
  const ratings = await Rating.find({ rideId }).sort({ createdAt: 1 });
  return ratings.map(toRatingView);
}

/* ================================ Averages ================================= */

/** Average score and count received by each user, in one grouped query. */
export async function ratingSummaries(userIds: (string | Types.ObjectId)[]): Promise<Map<string, RatingSummary>> {
  const ids = userIds.map((id) => new Types.ObjectId(String(id)));
  const rows = await Rating.aggregate<{ _id: Types.ObjectId; average: number; count: number }>([
    { $match: { toUserId: { $in: ids }, ...FROM_RIDERS } },
    { $group: { _id: "$toUserId", average: { $avg: "$score" }, count: { $sum: 1 } } },
  ]);
  const map = new Map<string, RatingSummary>();
  for (const id of ids) map.set(String(id), { average: null, count: 0 });
  for (const row of rows) map.set(String(row._id), { average: Math.round(row.average * 10) / 10, count: row.count });
  return map;
}

export async function ratingSummary(userId: string | Types.ObjectId): Promise<RatingSummary> {
  return (await ratingSummaries([userId])).get(String(userId)) ?? { average: null, count: 0 };
}

/* ============================ Ratings I received =========================== */

export interface ReceivedQuery {
  page: number;
  limit: number;
  score?: number;
}

/**
 * GET /api/ratings/me (DRIVER): ratings riders gave this driver, newest first,
 * plus a summary (average, count, 1-5 breakdown) over ALL of them, so the
 * summary doesn't change with the page or the score filter.
 */
export async function listReceivedRatings(viewer: Viewer, { page, limit, score }: ReceivedQuery) {
  const toUserId = new Types.ObjectId(viewer.userId);
  const allFilter = { toUserId, ...FROM_RIDERS };
  const listFilter = { ...allFilter, ...(score ? { score } : {}) };

  const [total, ratings, groups] = await Promise.all([
    Rating.countDocuments(listFilter),
    // _id breaks ties so pages never overlap or skip items when two ratings share a timestamp.
    Rating.find(listFilter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Rating.aggregate<{ _id: number; count: number }>([
      { $match: allFilter },
      { $group: { _id: "$score", count: { $sum: 1 } } },
    ]),
  ]);

  const breakdown: Record<string, number> = { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0 };
  let count = 0;
  let sum = 0;
  for (const g of groups) {
    breakdown[String(g._id)] = g.count;
    count += g.count;
    sum += g._id * g.count;
  }

  // Rides and rater names for this page, in two queries.
  const [rides, raters] = await Promise.all([
    Ride.find({ _id: { $in: ratings.map((r) => r.rideId) } }),
    User.find({ _id: { $in: ratings.map((r) => r.fromUserId) } }, { name: 1 }),
  ]);

  const rideById = new Map(rides.map((x) => [String(x._id), x]));
  const nameById = new Map(raters.map((u) => [String(u._id), u.name]));

  return {
    summary: { average: count ? Math.round((sum / count) * 10) / 10 : null, count, breakdown },
    reviews: ratings.map((r) => {
      const ride = rideById.get(String(r.rideId));
      return {
        ...toRatingView(r),
        // A deleted account still shows a placeholder rather than failing.
        from: { name: nameById.get(String(r.fromUserId)) ?? "User" },
        ride: ride
          ? {
              pickup: ride.pickup.address,
              destination: ride.destination.address,
              vehicleType: ride.vehicleType,
              completedAt: ride.completedAt ?? null,
            }
          : null,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/* ================================== Admin ================================== */

/**
 * GET /api/admin/reviews: passengers' reviews of drivers, newest first, in the
 * shape the admin "Rating & Review" page expects.
 */
export async function listDriverReviewsForAdmin(limit = 200) {
  const ratings = await Rating.find({ fromRole: "PASSENGER" }).sort({ createdAt: -1 }).limit(limit);
  const [rides, users] = await Promise.all([
    Ride.find({ _id: { $in: ratings.map((r) => r.rideId) } }),
    User.find({ _id: { $in: ratings.flatMap((r) => [r.fromUserId, r.toUserId]) } }, { name: 1 }),
  ]);
  const nameOf = (id: Types.ObjectId) => users.find((u) => u._id.equals(id))?.name ?? "User";

  return ratings.map((r) => {
    const ride = rides.find((x) => x._id.equals(r.rideId));
    return {
      id: r.id as string,
      rideId: String(r.rideId),
      customerName: nameOf(r.fromUserId),
      driverName: nameOf(r.toUserId),
      rating: r.score,
      vehicleType: ride?.vehicleType ?? "—",
      route: ride ? `${ride.pickup.address} → ${ride.destination.address}` : "—",
      date: r.createdAt.toISOString(),
      comment: r.comment ?? "",
      status: "Published",
    };
  });
}
