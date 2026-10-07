import { DriverProfile } from "../models/DriverProfile.js";
import { Vehicle } from "../models/Vehicle.js";
import { DriverDocument, DOCUMENT_TYPES, type DocumentType } from "../models/DriverDocument.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";



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
  const [users, vehicles, documents] = await Promise.all([
    User.find({ _id: { $in: profiles.map((p) => p.userId) } }, { name: 1, email: 1, phone: 1 }),
    Vehicle.find({ driverId: { $in: profileIds } }),
    DriverDocument.find({ driverId: { $in: profileIds } }).sort({ documentType: 1 }),
  ]);

  const drivers = profiles.map((profile) => {
    const id = String(profile._id);
    const user = users.find((u) => String(u._id) === String(profile.userId));
    const vehicle = vehicles.find((v) => String(v.driverId) === id);
    const docs = documents.filter((d) => String(d.driverId) === id);

    return {
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

async function findPendingDriver(driverId: string) {
  const profile = await DriverProfile.findById(driverId);
  if (!profile) throw new AppError(404, "Driver profile not found.");
  if (profile.verificationStatus !== "PENDING") {
    throw new AppError(409, `Driver is already ${profile.verificationStatus}.`);
  }
  return profile;
}

/**
 * Approve: only a complete submission (vehicle + all 4 document types) can be
 * verified. The profile update is conditional on still being PENDING, so two
 * admins clicking at once can't double-process it.
 */
export async function verifyDriver(adminId: string, driverId: string) {
  const profile = await findPendingDriver(driverId);

  const [hasVehicle, docs] = await Promise.all([
    Vehicle.exists({ driverId: profile._id }),
    DriverDocument.find({ driverId: profile._id }, { documentType: 1 }),
  ]);
  const missing = missingItems(Boolean(hasVehicle), docs.map((d) => d.documentType));
  if (missing.length) {
    throw new AppError(400, `Driver can't be verified yet. Missing: ${missing.join(", ")}.`);
  }

  const now = new Date();
  const updated = await DriverProfile.findOneAndUpdate(
    { _id: profile._id, verificationStatus: "PENDING" },
    { $set: { verificationStatus: "VERIFIED", verifiedAt: now, reviewedBy: adminId }, $unset: { rejectionReason: "" } },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError(409, "Driver was updated by someone else. Refresh and try again.");

  // Two separate writes (no transaction): the profile status is the source of
  // truth; document statuses are informational. A transaction would make this
  // all-or-nothing at the cost of extra latency.
  await DriverDocument.updateMany(
    { driverId: profile._id },
    { $set: { verificationStatus: "VERIFIED", verifiedAt: now }, $unset: { rejectionReason: "" } },
  );

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
  const profile = await findPendingDriver(driverId);

  const updated = await DriverProfile.findOneAndUpdate(
    { _id: profile._id, verificationStatus: "PENDING" },
    {
      $set: { verificationStatus: "REJECTED", rejectionReason, reviewedBy: adminId },
      $unset: { verifiedAt: "" },
    },
    { returnDocument: "after" },
  );
  if (!updated) throw new AppError(409, "Driver was updated by someone else. Refresh and try again.");

  if (documentTypes.length) {
    await DriverDocument.updateMany(
      { driverId: profile._id, documentType: { $in: documentTypes } },
      { $set: { verificationStatus: "REJECTED", rejectionReason }, $unset: { verifiedAt: "" } },
    );
  }

  return updated.toJSON();
}
