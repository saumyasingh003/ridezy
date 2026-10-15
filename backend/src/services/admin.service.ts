import { Types } from "mongoose";
import { DriverProfile } from "../models/DriverProfile.js";
import { Vehicle } from "../models/Vehicle.js";
import { DriverDocument, DOCUMENT_TYPES, type DocumentType } from "../models/DriverDocument.js";
import { User } from "../models/User.js";
import { PassengerProfile } from "../models/PassengerProfile.js";
import { ACTIVE_RIDE_STATUSES, Ride } from "../models/Ride.js";
import { Payment } from "../models/Payment.js";
import { AuditLog } from "../models/AuditLog.js";
import { Rating } from "../models/Rating.js";
import { AppError } from "../utils/AppError.js";
import { listDriverReviewsForAdmin, ratingSummaries, ratingSummary } from "./rating.service.js";
import { inBackground, notifications } from "./notification.service.js";



/**
 * PENDING drivers, oldest first, with everything an admin needs to decide:
 * contact details, vehicle, documents and whether the submission is complete.
 * Uses 3 batched `$in` queries instead of one query per driver (avoids N+1).
 */
export async function listPendingDrivers({ page, limit }: { page: number; limit: number }) {
  const filter = { verificationStatus: "PENDING" } as const;
  const [profiles, total] = await Promise.all([
    DriverProfile.find(filter)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    DriverProfile.countDocuments(filter),
  ]);

  const profileIds = profiles.map((p) => p._id);
  const userIds = profiles.map((p) => p.userId);
  const [users, vehicles, documents] = await Promise.all([
    User.find({ _id: { $in: userIds } }, { name: 1, email: 1, phone: 1 }),
    Vehicle.find({ $or: [{ driverId: { $in: profileIds } }, { driverId: { $in: userIds } }] }),
    DriverDocument.find({ $or: [{ driverId: { $in: profileIds } }, { driverId: { $in: userIds } }] }).sort({ documentType: 1 }),
  ]);

  const drivers = profiles.map((profile) => {
    const profIdStr = String(profile._id);
    const userIdStr = String(profile.userId);
    const user = users.find((u) => String(u._id) === userIdStr);
    const vehicle = vehicles.find((v) => String(v.driverId) === profIdStr || String(v.driverId) === userIdStr);
    const docs = documents.filter((d) => String(d.driverId) === profIdStr || String(d.driverId) === userIdStr);

    return {
      id: profIdStr,
      driverProfileId: profIdStr,
      ...profile.toJSON(),
      user: user ? { name: user.name, email: user.email, phone: user.phone ?? null } : null,
      vehicle: vehicle?.toJSON() ?? null,
      documents: docs.map((d) => d.toJSON()),
      missing: missingItems(Boolean(vehicle), docs.map((d) => d.documentType)),
    };
  });

  return { drivers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

function missingItems(hasVehicle: boolean, submitted: string[]): string[] {
  return [...(hasVehicle ? [] : ["VEHICLE"]), ...DOCUMENT_TYPES.filter((type) => !submitted.includes(type))];
}

async function findDriverForReview(driverId: string) {
  let profile = await DriverProfile.findById(driverId);
  if (!profile) {
    profile = await DriverProfile.findOne({ userId: driverId });
  }
  if (!profile) throw new AppError(404, "Driver profile not found.");
  return profile;
}

/**
 * Approve: only a complete submission (vehicle + all 4 document types) can be
 * verified. The profile update is applied and sets verificationStatus to VERIFIED.
 */
export async function verifyDriver(adminId: string, driverId: string) {
  const profile = await findDriverForReview(driverId);
  const targetDriverIds = [profile._id, profile.userId].filter(Boolean);

  const [hasVehicle, docs] = await Promise.all([
    Vehicle.exists({ driverId: { $in: targetDriverIds } }),
    DriverDocument.find({ driverId: { $in: targetDriverIds } }, { documentType: 1 }),
  ]);
  const missing = missingItems(Boolean(hasVehicle), docs.map((d) => d.documentType));
  if (missing.length) {
    throw new AppError(400, `Driver can't be verified yet. Missing: ${missing.join(", ")}.`);
  }

  const now = new Date();
  const updated = await DriverProfile.findOneAndUpdate(
    { _id: profile._id },
    { $set: { verificationStatus: "VERIFIED", verifiedAt: now, reviewedBy: adminId }, $unset: { rejectionReason: "" } },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError(404, "Driver profile not found.");

  await DriverDocument.updateMany(
    { driverId: { $in: targetDriverIds } },
    { $set: { verificationStatus: "VERIFIED", verifiedAt: now }, $unset: { rejectionReason: "" } },
  );

  await AuditLog.create({
    adminId,
    action: "DRIVER_VERIFIED",
    targetType: "DRIVER",
    targetId: String(profile._id),
    details: { driverProfileId: String(profile._id), userId: String(profile.userId) },
  });

  inBackground(() => notifications.driverVerified(updated.userId));
  return updated.toJSON();
}

/**
 * Reject with a reason. `documentTypes` (optional) marks exactly which
 * documents were the problem, so the driver knows what to re-upload.
 */
export async function rejectDriver(
  adminId: string,
  driverId: string,
  { rejectionReason, documentTypes = [] }: { rejectionReason: string; documentTypes?: DocumentType[] },
) {
  const profile = await findDriverForReview(driverId);
  const targetDriverIds = [profile._id, profile.userId].filter(Boolean);

  const updated = await DriverProfile.findOneAndUpdate(
    { _id: profile._id },
    {
      $set: {
        verificationStatus: "REJECTED",
        rejectionReason: rejectionReason || "Driver profile does not meet platform verification standards.",
        reviewedBy: adminId,
      },
      $unset: { verifiedAt: "" },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError(404, "Driver profile not found.");

  if (documentTypes.length) {
    await DriverDocument.updateMany(
      { driverId: { $in: targetDriverIds }, documentType: { $in: documentTypes } },
      { $set: { verificationStatus: "REJECTED", rejectionReason }, $unset: { verifiedAt: "" } },
    );
  }

  await AuditLog.create({
    adminId,
    action: "DRIVER_REJECTED",
    targetType: "DRIVER",
    targetId: String(profile._id),
    details: {
      driverProfileId: String(profile._id),
      userId: String(profile.userId),
      rejectionReason: rejectionReason || "Driver profile does not meet platform verification standards.",
      documentTypes,
    },
  });

  inBackground(() => notifications.driverRejected(updated.userId, updated.rejectionReason ?? rejectionReason));
  return updated.toJSON();
}

export async function getAdminStats() {
  const [totalCustomers, totalDrivers, verifiedDrivers, totalRides, activeRides, ratingRows] = await Promise.all([
    User.countDocuments({ role: "PASSENGER" }),
    User.countDocuments({ role: "DRIVER" }),
    DriverProfile.countDocuments({ verificationStatus: "VERIFIED" }),
    Ride.countDocuments(),
    Ride.countDocuments({ status: { $in: ACTIVE_RIDE_STATUSES } }),
    // Platform rating = average of all riders' ratings of drivers.
    Rating.aggregate<{ average: number; count: number }>([
      { $match: { fromRole: "PASSENGER" } },
      { $group: { _id: null, average: { $avg: "$score" }, count: { $sum: 1 } } },
    ]),
  ]);
  const ratings = ratingRows[0];

  const pendingDrivers = Math.max(0, totalDrivers - verifiedDrivers);

  return {
    totalCustomers,
    totalDrivers,
    pendingDrivers,
    verifiedDrivers,
    totalRides,
    activeRides,
    averageRating: ratings ? Math.round(ratings.average * 10) / 10 : 0,
    totalRatings: ratings?.count ?? 0,
  };
}

export async function listCustomers({
  page = 1,
  limit = 20,
  search,
}: {
  page?: number;
  limit?: number;
  search?: string;
}) {
  const query: Record<string, any> = { role: "PASSENGER" };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      { phone: { $regex: search, $options: "i" } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query, { name: 1, email: 1, phone: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(query),
  ]);

  const userIds = users.map((u) => u._id);
  // Ride counts for this page of customers in one grouped query (not one per customer).
  const [profiles, rideCounts] = await Promise.all([
    PassengerProfile.find({ userId: { $in: userIds } }),
    Ride.aggregate<{ _id: unknown; total: number; completed: number }>([
      { $match: { passengerId: { $in: userIds } } },
      {
        $group: {
          _id: "$passengerId",
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "RIDE_COMPLETED"] }, 1, 0] } },
        },
      },
    ]),
  ]);

  const customers = users.map((u) => {
    const prof = profiles.find((p) => String(p.userId) === String(u._id));
    return {
      id: String(u._id),
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      createdAt: u.createdAt,
      gender: prof?.gender ?? null,
      dateOfBirth: prof?.dateOfBirth ?? null,
      profileImage: prof?.profileImage ?? null,
      savedPlacesCount: prof?.savedPlaces?.length ?? 0,
      ridesCount: rideCounts.find((r) => String(r._id) === String(u._id))?.total ?? 0,
      completedRidesCount: rideCounts.find((r) => String(r._id) === String(u._id))?.completed ?? 0,
    };
  });

  return { customers, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
}

export async function listAllDrivers({
  page = 1,
  limit = 20,
  status,
  search,
}: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
}) {
  // Query all users registered as DRIVER
  const userQuery: Record<string, any> = { role: "DRIVER" };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    userQuery.$or = [{ name: rx }, { email: rx }, { phone: rx }];
  }

  const driverUsers = await User.find(userQuery).sort({ createdAt: -1 });
  const userIds = driverUsers.map((u) => u._id);

  // Find any associated DriverProfiles
  const profiles = await DriverProfile.find({ userId: { $in: userIds } });
  const profileIds = profiles.map((p) => p._id);

  const [vehicles, ridesCounts, driverDocs, ratings] = await Promise.all([
    Vehicle.find({ driverId: { $in: profileIds } }),
    Ride.aggregate([
      { $match: { assignedDriverId: { $in: [...profileIds, ...userIds] }, status: "RIDE_COMPLETED" } },
      { $group: { _id: "$assignedDriverId", count: { $sum: 1 } } },
    ]),
    DriverDocument.find({
      $or: [{ driverId: { $in: profileIds } }, { driverId: { $in: userIds } }],
      documentType: "DRIVING_LICENSE",
    }),
    // Real average from passengers' ratings (was a hard-coded 5.0).
    ratingSummaries(userIds),
  ]);

  let drivers = driverUsers.map((user) => {
    const profile = profiles.find((p) => String(p.userId) === String(user._id));
    const profileId = profile ? String(profile._id) : String(user._id);
    const vehicle = profile ? vehicles.find((v) => String(v.driverId) === String(profile._id)) : null;
    const tripsFound = ridesCounts.find(
      (r) =>
        (profile && String(r._id) === String(profile._id)) ||
        String(r._id) === String(user._id)
    );
    const tripCount = tripsFound?.count || 0;
    const dlDoc = driverDocs.find(
      (d) =>
        (profile && String(d.driverId) === String(profile._id)) ||
        String(d.driverId) === String(user._id)
    );
    const resolvedLicense = profile?.licenseNumber || dlDoc?.documentNumber || "";

    return {
      id: profileId,
      driverProfileId: profileId,
      userId: String(user._id),
      name: user.name || "Driver",
      email: user.email || "",
      phone: user.phone || null,
      licenseNumber: resolvedLicense,
      licenseNo: resolvedLicense,
      drivingLicense: resolvedLicense,
      verificationStatus: profile?.verificationStatus || "PENDING",
      availabilityStatus: profile?.availabilityStatus || "OFFLINE",
      rating: ratings.get(String(user._id))?.average ?? null,
      ratingCount: ratings.get(String(user._id))?.count ?? 0,
      totalTrips: tripCount,
      gender: profile?.gender ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      profileImage: profile?.profileImage ?? null,
      vehicle: vehicle
        ? {
            make: vehicle.make,
            model: vehicle.model,
            registrationNumber: vehicle.registrationNumber,
            vehicleType: vehicle.vehicleType,
            color: vehicle.color,
            year: vehicle.year,
            vehicleImage: vehicle.vehicleImage ?? null,
          }
        : null,
      createdAt: profile?.createdAt || user.createdAt,
    };
  });

  if (status && status !== "ALL") {
    drivers = drivers.filter((d) => d.verificationStatus === status);
  }

  const total = drivers.length;
  const paginatedDrivers = drivers.slice((page - 1) * limit, page * limit);

  return { drivers: paginatedDrivers, pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 } };
}

export async function getDriverDetails(driverId: string) {
  let profile = await DriverProfile.findById(driverId);
  if (!profile) {
    profile = await DriverProfile.findOne({ userId: driverId });
  }

  let user = profile ? await User.findById(profile.userId) : await User.findById(driverId);
  if (!user || user.role !== "DRIVER") {
    if (!profile) throw new AppError(404, "Driver profile not found.");
  }

  const profileObjectId = profile?._id;

  const targetDriverIds = [
    ...(profileObjectId ? [profileObjectId] : []),
    ...(profile?.userId ? [profile.userId] : []),
    ...(user?._id ? [user._id] : []),
  ];

  const [vehicle, documents, tripsCount, driverRides] = targetDriverIds.length
    ? await Promise.all([
        Vehicle.findOne({ driverId: { $in: targetDriverIds } }),
        DriverDocument.find({ driverId: { $in: targetDriverIds } }).sort({ documentType: 1 }),
        Ride.countDocuments({ assignedDriverId: { $in: targetDriverIds }, status: "RIDE_COMPLETED" }),
        Ride.find({ assignedDriverId: { $in: targetDriverIds } }).sort({ createdAt: -1 }).limit(100),
      ])
    : [null, [], 0, []];

  const passengerIds = [...new Set(driverRides.map((r) => r.passengerId).filter(Boolean))];
  const passengers = passengerIds.length
    ? await User.find({ _id: { $in: passengerIds } }, { name: 1, phone: 1, email: 1 })
    : [];
  const passengerMap = new Map(passengers.map((p) => [String(p._id), p]));

  const formattedRides = driverRides.map((r) => {
    const passenger = passengerMap.get(String(r.passengerId));
    return {
      id: String(r._id),
      pickup: r.pickup ? { address: r.pickup.address, latitude: r.pickup.latitude, longitude: r.pickup.longitude } : null,
      destination: r.destination ? { address: r.destination.address, latitude: r.destination.latitude, longitude: r.destination.longitude } : null,
      fare: r.estimatedFare,
      distanceKm: r.distanceKm,
      durationMinutes: r.estimatedDurationMinutes,
      vehicleType: r.vehicleType,
      status: r.status,
      passenger: passenger
        ? {
            id: String(passenger._id),
            name: passenger.name,
            phone: passenger.phone ?? null,
            email: passenger.email ?? null,
          }
        : null,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    };
  });

  const resolvedId = profile ? String(profile._id) : (user ? String(user._id) : driverId);
  const resolvedUserId = user ? String(user._id) : (profile ? String(profile.userId) : driverId);
  const driverRating = await ratingSummary(resolvedUserId);

  return {
    id: resolvedId,
    driverProfileId: resolvedId,
    userId: resolvedUserId,
    name: user?.name || "Driver",
    email: user?.email || "",
    phone: user?.phone || null,
    licenseNumber: profile?.licenseNumber || "—",
    verificationStatus: profile?.verificationStatus || "PENDING",
    availabilityStatus: profile?.availabilityStatus || "OFFLINE",
    gender: profile?.gender ?? null,
    dateOfBirth: profile?.dateOfBirth ?? null,
    profileImage: profile?.profileImage ?? null,
    verifiedAt: profile?.verifiedAt ?? null,
    rejectionReason: profile?.rejectionReason ?? null,
    user: user
      ? {
          id: String(user._id),
          name: user.name,
          email: user.email,
          phone: user.phone ?? null,
          role: user.role,
          createdAt: user.createdAt,
          isEmailVerified: user.isEmailVerified,
        }
      : null,
    vehicle: vehicle
      ? {
          ...vehicle.toJSON(),
          vehicleImage: vehicle.vehicleImage ?? null,
        }
      : null,
    documents: documents.map((d) => d.toJSON()),
    totalTrips: tripsCount,
    totalAllRides: driverRides.length,
    rides: formattedRides,
    rating: driverRating.average,
    ratingCount: driverRating.count,
    createdAt: profile?.createdAt || user?.createdAt,
    updatedAt: profile?.updatedAt || user?.updatedAt,
  };
}

export async function deleteDriverProfile(driverId: string): Promise<void> {
  let profile = await DriverProfile.findById(driverId);
  if (!profile) {
    profile = await DriverProfile.findOne({ userId: driverId });
  }

  const userId = profile?.userId || driverId;

  if (profile) {
    await Vehicle.deleteMany({ driverId: profile._id });
    await DriverDocument.deleteMany({ driverId: profile._id });
    await DriverProfile.deleteOne({ _id: profile._id });
  }

  await Vehicle.deleteMany({ driverId: userId });
  await DriverDocument.deleteMany({ driverId: userId });
  await User.deleteOne({ _id: userId });
}

/** Passengers' reviews of drivers (real ratings; this used to return []). */
export async function listReviews() {
  return listDriverReviewsForAdmin();
}

export async function updateDriverProfile(driverId: string, input: any) {
  let profile = await DriverProfile.findById(driverId);
  if (!profile) {
    profile = await DriverProfile.findOne({ userId: driverId });
  }
  const userId = profile ? String(profile.userId) : driverId;
  const { updateProfile } = await import("./driver.service.js");
  const updated = await updateProfile(userId, input);

  if (input.vehicleImage !== undefined) {
    const vImg = input.vehicleImage ? String(input.vehicleImage).trim() : null;
    const profileId = profile?._id || driverId;
    await Vehicle.updateOne(
      { $or: [{ driverId: profileId }, { driverId: userId }] },
      { $set: { vehicleImage: vImg } }
    );
  }

  return updated;
}

export async function suspendDriver(adminId: string, driverId: string, reason: string) {
  let profile = await DriverProfile.findById(driverId);
  if (!profile) {
    profile = await DriverProfile.findOne({ userId: driverId });
  }
  if (!profile) throw new AppError(404, "Driver profile not found.");

  profile.verificationStatus = "SUSPENDED";
  profile.suspensionReason = reason;
  profile.suspendedAt = new Date();
  profile.reviewedBy = new Types.ObjectId(adminId);
  profile.availabilityStatus = "OFFLINE";
  profile.location = undefined;
  await profile.save();

  await AuditLog.create({
    adminId,
    action: "DRIVER_SUSPENDED",
    targetType: "DRIVER",
    targetId: String(profile._id),
    details: { reason },
  });

  return getDriverDetails(String(profile._id));
}

export async function activateDriver(adminId: string, driverId: string) {
  let profile = await DriverProfile.findById(driverId);
  if (!profile) {
    profile = await DriverProfile.findOne({ userId: driverId });
  }
  if (!profile) throw new AppError(404, "Driver profile not found.");

  profile.verificationStatus = "VERIFIED";
  profile.suspensionReason = undefined;
  profile.suspendedAt = undefined;
  profile.reviewedBy = new Types.ObjectId(adminId);
  await profile.save();

  await AuditLog.create({
    adminId,
    action: "DRIVER_ACTIVATED",
    targetType: "DRIVER",
    targetId: String(profile._id),
  });

  return getDriverDetails(String(profile._id));
}

export async function listAllRides({ page, limit, status }: { page: number; limit: number; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [total, rides] = await Promise.all([
    Ride.countDocuments(filter),
    Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("passengerId", "name phone email")
      .populate({
        path: "assignedDriverId",
        populate: { path: "userId", select: "name phone email" },
      }),
  ]);

  const formatted = rides.map((r) => {
    const p = r.passengerId as any;
    const d = r.assignedDriverId as any;
    const dUser = d?.userId as any;
    return {
      id: String(r._id),
      status: r.status,
      pickup: r.pickup,
      destination: r.destination,
      vehicleType: r.vehicleType,
      distanceKm: r.distanceKm,
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      estimatedFare: r.estimatedFare,
      finalFare: r.finalFare ?? null,
      currency: "INR",
      createdAt: r.createdAt,
      assignedAt: r.assignedAt ?? null,
      completedAt: r.completedAt ?? null,
      cancelledAt: r.cancelledAt ?? null,
      passenger: p ? { id: String(p._id), name: p.name, phone: p.phone, email: p.email } : null,
      driver: dUser ? { id: String(d._id), name: dUser.name, phone: dUser.phone, email: dUser.email } : null,
    };
  });

  return {
    rides: formatted,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function listActiveRides({ page, limit }: { page: number; limit: number }) {
  const filter = { status: { $in: ACTIVE_RIDE_STATUSES } };
  const [total, rides] = await Promise.all([
    Ride.countDocuments(filter),
    Ride.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("passengerId", "name phone email")
      .populate({
        path: "assignedDriverId",
        populate: { path: "userId", select: "name phone email" },
      }),
  ]);

  const formatted = rides.map((r) => {
    const p = r.passengerId as any;
    const d = r.assignedDriverId as any;
    const dUser = d?.userId as any;
    return {
      id: String(r._id),
      status: r.status,
      pickup: r.pickup,
      destination: r.destination,
      vehicleType: r.vehicleType,
      distanceKm: r.distanceKm,
      estimatedDurationMinutes: r.estimatedDurationMinutes,
      estimatedFare: r.estimatedFare,
      finalFare: r.finalFare ?? null,
      currency: "INR",
      createdAt: r.createdAt,
      passenger: p ? { id: String(p._id), name: p.name, phone: p.phone, email: p.email } : null,
      driver: dUser ? { id: String(d._id), name: dUser.name, phone: dUser.phone, email: dUser.email } : null,
    };
  });

  return {
    rides: formatted,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function listAllPayments({ page, limit, status }: { page: number; limit: number; status?: string }) {
  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;

  const [total, payments, totals] = await Promise.all([
    Payment.countDocuments(filter),
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("passengerId", "name email phone")
      .populate({
        path: "driverId",
        populate: { path: "userId", select: "name email phone" },
      })
      .populate("rideId"),
    Payment.aggregate<{ _id: string; amount: number; tips: number; count: number }>([
      {
        $group: {
          _id: "$status",
          amount: { $sum: "$amount" },
          tips: { $sum: { $ifNull: ["$tipAmount", 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const byStatus = (s: string) => totals.find((t) => t._id === s);

  const formatted = payments.map((p) => {
    const passenger = p.passengerId as any;
    const driver = p.driverId as any;
    const driverUser = driver?.userId as any;
    const ride = p.rideId as any;
    return {
      id: String(p._id),
      rideId: ride ? String(ride._id) : String(p.rideId),
      amount: p.amount,
      // Tip kept apart from the fare: it goes entirely to the driver.
      baseFare: p.baseFare ?? p.amount - (p.tipAmount ?? 0),
      tipAmount: p.tipAmount ?? 0,
      tipPaid: (p.tipAmount ?? 0) > 0 && p.status === "COMPLETED",
      currency: p.currency,
      method: p.method,
      status: p.status,
      provider: p.provider,
      providerPaymentId: p.providerPaymentId ?? null,
      failureReason: p.failureReason ?? null,
      paidAt: p.paidAt ?? null,
      createdAt: p.createdAt,
      passenger: passenger ? { id: String(passenger._id), name: passenger.name, email: passenger.email } : null,
      driver: driverUser ? { id: String(driver._id), name: driverUser.name, email: driverUser.email } : null,
      ride: ride
        ? {
            pickup: ride.pickup?.address,
            destination: ride.destination?.address,
            vehicleType: ride.vehicleType,
          }
        : null,
    };
  });

  const paidAmount = (byStatus("COMPLETED")?.amount || 0) + (byStatus("PAID")?.amount || 0);
  const paidCount = (byStatus("COMPLETED")?.count || 0) + (byStatus("PAID")?.count || 0);
  const pendingAmount = byStatus("PENDING")?.amount ?? 0;
  const pendingCount = byStatus("PENDING")?.count ?? 0;
  const failedAmount = byStatus("FAILED")?.amount ?? 0;
  const failedCount = byStatus("FAILED")?.count ?? 0;

  // Tips are the driver's: excluded from the fare that commission is taken on.
  const paidTips = (byStatus("COMPLETED")?.tips || 0) + (byStatus("PAID")?.tips || 0);
  const paidFares = paidAmount - paidTips;

  // Strictly exclude FAILED transactions from totalAmount, commission, and company profit
  const totalAmount = paidAmount;
  const commission8Percent = Math.round(paidFares * 0.08 * 100) / 100;
  const companyProfit = commission8Percent;

  return {
    payments: formatted,
    totals: {
      totalRevenue: totalAmount,
      totalAmount,
      commission8Percent,
      companyProfit,
      successfulCount: paidCount,
      paidFares,
      paidTips,
      pendingCount,
      failedCount,
      failedAmount,
    },
    summary: {
      currency: "INR",
      totalAmount,
      commission8Percent,
      companyProfit,
      paidAmount,
      paidCount,
      paidFares,
      paidTips,
      pendingAmount,
      pendingCount,
      failedAmount,
      failedCount,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export async function getAnalytics({ from, to }: { from?: string; to?: string }) {
  const fromDate = from ? new Date(from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : new Date();
  if (to && !to.includes("T")) {
    toDate.setHours(23, 5, 59, 999);
  }

  const dateFilter = { createdAt: { $gte: fromDate, $lte: toDate } };

  const [
    totalRides,
    completedRides,
    cancelledRides,
    activeDrivers,
    totalDrivers,
    totalPassengers,
    completedPaymentsTotal,
  ] = await Promise.all([
    Ride.countDocuments(dateFilter),
    Ride.countDocuments({ ...dateFilter, status: "RIDE_COMPLETED" }),
    Ride.countDocuments({ ...dateFilter, status: "CANCELLED" }),
    DriverProfile.countDocuments({ verificationStatus: "VERIFIED", availabilityStatus: { $in: ["AVAILABLE", "BUSY"] } }),
    DriverProfile.countDocuments(),
    User.countDocuments({ role: "PASSENGER" }),
    Payment.aggregate<{ total: number }>([
      { $match: { ...dateFilter, status: { $in: ["COMPLETED", "PAID"] } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
  ]);

  const revenueAmount = completedPaymentsTotal[0]?.total ?? 0;

  return {
    totalRides,
    completedRides,
    cancelledRides,
    activeDrivers,
    totalDrivers,
    totalPassengers,
    totalRevenue: revenueAmount,
    currency: "INR",
    revenue: {
      amount: revenueAmount,
      currency: "INR",
    },
    timeframe: {
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
    },
  };
}

export async function listAuditLogs({ page, limit }: { page: number; limit: number }) {
  const [total, logs] = await Promise.all([
    AuditLog.countDocuments(),
    AuditLog.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("adminId", "name email role"),
  ]);

  // Who each log is about (name/email), so the UI can show people, not ids.
  const driverIds = logs
    .filter((log) => log.targetType === "DRIVER" && Types.ObjectId.isValid(log.targetId))
    .map((log) => new Types.ObjectId(log.targetId));
  const drivers = driverIds.length
    ? await DriverProfile.find({ _id: { $in: driverIds } }, { userId: 1 }).populate<{
        userId: { name: string; email: string } | null;
      }>("userId", "name email")
    : [];
  const targets = new Map(
    drivers.map((d) => [String(d._id), d.userId ? { name: d.userId.name, email: d.userId.email } : null]),
  );

  const formattedLogs = logs.map((log) => {
    const admin = log.adminId as any;
    return {
      id: String(log._id),
      _id: String(log._id),
      action: log.action,
      targetType: log.targetType,
      targetId: log.targetId,
      details: log.details ?? null,
      target: targets.get(log.targetId) ?? null,
      createdAt: log.createdAt,
      admin: admin
        ? { id: String(admin._id), name: admin.name, email: admin.email, role: admin.role }
        : null,
    };
  });

  return {
    auditLogs: formattedLogs,
    logs: formattedLogs,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}
