import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { DriverProfile, type DriverProfileDocument } from "../models/DriverProfile.js";
import { Vehicle } from "../models/Vehicle.js";
import { Ride } from "../models/Ride.js";
import { DOCUMENT_TYPES, DriverDocument, documentNumberError, type DocumentType } from "../models/DriverDocument.js";
import type { Gender } from "../models/shared.js";
import { AppError } from "../utils/AppError.js";
import { duplicateKeyField, toMongoUpdate } from "../utils/mongo.js";
import { getUserContact, setUserPhone } from "./user.service.js";
import { inBackground, notifications } from "./notification.service.js";

export interface DriverProfileInput {
  name?: string;
  phone?: string;
  profileImage?: string | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
  licenseNumber?: string;
}

export interface VehicleInput {
  vehicleType: "BIKE" | "AUTO" | "CAB";
  make: string;
  model: string;
  year: number;
  color: string;
  registrationNumber: string;
  vehicleImage?: string | null;
}

export interface DocumentInput {
  documentType: DocumentType;
  documentNumber: string;
  documentUrl: string;
}

const NOT_FOUND = "Driver profile not found. Create one first.";
const VEHICLE_NOT_FOUND = "Vehicle not found.";

const DUPLICATE_MESSAGES: Record<string, string> = {
  userId: "Driver profile already exists. Use PATCH to update it.",
  licenseNumber: "This license number is already registered to another driver.",
  driverId: "You already have a vehicle. Use PATCH to update it.",
  registrationNumber: "A vehicle with this registration number is already registered.",
  documentType: "You already submitted this document type. Use PATCH to replace it.",
};

/** Turns a unique-index violation into a specific 409; rethrows anything else. */
function rethrowDuplicate(err: unknown): never {
  const field = duplicateKeyField(err);
  if (field) throw new AppError(409, DUPLICATE_MESSAGES[field] ?? "A record with these details already exists.");
  throw err;
}

/**
 * What the driver sees: admin-only audit data (reviewedBy) is left out, and so
 * is location, which has its own endpoint (GET /api/drivers/location).
 */
async function toView(profile: DriverProfileDocument) {
  const {
    userId: _userId,
    reviewedBy: _reviewedBy,
    location: _location,
    lastLocationUpdatedAt: _lastLocationUpdatedAt,
    ...rest
  } = profile.toJSON();
  return { ...rest, ...(await getUserContact(profile.userId)) };
}

async function findOwnProfile(userId: string): Promise<DriverProfileDocument> {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, NOT_FOUND);
  return profile;
}

/**
 * Anything the admin approved (licence, vehicle, documents) changed, so the
 * driver goes back to PENDING and needs a fresh review. Prevents "get
 * verified, then swap in a different car".
 *
 * An AVAILABLE driver is also taken OFFLINE (and their location dropped), so
 * "AVAILABLE means VERIFIED with a vehicle" always holds. It is one pipeline
 * update, so it is atomic. BUSY is left alone: an ongoing ride is the Ride
 * module's responsibility.
 */
async function resetVerification(driverId: Types.ObjectId): Promise<void> {
  const wasAvailable = { $eq: ["$availabilityStatus", "AVAILABLE"] };
  await DriverProfile.updateOne(
    { _id: driverId, verificationStatus: { $ne: "PENDING" } },
    [
      {
        $set: {
          verificationStatus: "PENDING",
          availabilityStatus: { $cond: [wasAvailable, "OFFLINE", "$availabilityStatus"] },
          location: { $cond: [wasAvailable, "$$REMOVE", "$location"] },
          lastLocationUpdatedAt: { $cond: [wasAvailable, "$$REMOVE", "$lastLocationUpdatedAt"] },
        },
      },
      { $unset: ["verifiedAt", "reviewedBy", "rejectionReason"] },
    ],
    { updatePipeline: true }, // Mongoose 9 requires opting in to pipeline updates
  );
}

/* ---------------------------------- Profile --------------------------------- */

export async function createProfile(userId: string, input: DriverProfileInput & { licenseNumber: string }) {
  if (await DriverProfile.exists({ userId })) throw new AppError(409, DUPLICATE_MESSAGES.userId!);

  const { phone, ...fields } = input;
  await setUserPhone(userId, phone);

  // verificationStatus / availabilityStatus come from schema defaults, never from input.
  const profile = await DriverProfile.create({ ...fields, userId }).catch(rethrowDuplicate);
  return toView(profile);
}

export async function getProfile(userId: string) {
  return toView(await findOwnProfile(userId));
}

export async function updateProfile(userId: string, input: DriverProfileInput) {
  const { phone, name, ...fields } = input;
  let current = await DriverProfile.findOne({ userId });
  if (!current) {
    if (fields.licenseNumber) {
      return createProfile(userId, { ...input, licenseNumber: fields.licenseNumber });
    }
    throw new AppError(404, NOT_FOUND);
  }
  if (phone !== undefined) {
    await setUserPhone(userId, phone);
  }
  if (name) {
    await User.updateOne({ _id: userId }, { $set: { name: name.trim() } });
  }

  const update = toMongoUpdate(fields);
  if (Object.keys(update).length) {
    await DriverProfile.updateOne({ _id: current._id }, update).catch(rethrowDuplicate);
  }
  if (fields.licenseNumber && fields.licenseNumber !== current.licenseNumber) {
    await resetVerification(current._id);
  }

  return getProfile(userId);
}

export async function deleteProfile(userId: string): Promise<void> {
  const profile = await DriverProfile.findOne({ userId });
  if (profile) {
    await Vehicle.deleteMany({ driverId: profile._id });
    await DriverDocument.deleteMany({ driverId: profile._id });
    await DriverProfile.deleteOne({ _id: profile._id });
  }
  await Vehicle.deleteMany({ driverId: userId });
  await DriverDocument.deleteMany({ driverId: userId });
  await User.deleteOne({ _id: userId });
}

/**
 * Tells admins once a PENDING driver has a vehicle and every required document,
 * i.e. the submission can be reviewed. Runs in the background after the
 * driver's own change has been saved.
 */
function notifyAdminsIfReadyForReview(profileId: Types.ObjectId): void {
  inBackground(async () => {
    const profile = await DriverProfile.findById(profileId, { userId: 1, verificationStatus: 1 });
    if (!profile || profile.verificationStatus !== "PENDING") return;
    const [hasVehicle, types, user] = await Promise.all([
      Vehicle.exists({ driverId: profile._id }),
      DriverDocument.distinct("documentType", { driverId: { $in: [profile._id, profile.userId] } }),
      User.findById(profile.userId, { name: 1 }),
    ]);
    const complete = Boolean(hasVehicle) && DOCUMENT_TYPES.every((t) => types.includes(t));
    if (complete) await notifications.driverReadyForReview(user?.name ?? "A driver", String(profile._id));
  });
}

/* ---------------------------------- Vehicle --------------------------------- */

export async function addVehicle(userId: string, input: VehicleInput) {
  const profile = await findOwnProfile(userId);
  const vehicle = await Vehicle.create({ ...input, driverId: profile._id }).catch(rethrowDuplicate);
  await resetVerification(profile._id);
  notifyAdminsIfReadyForReview(profile._id);
  return vehicle.toJSON();
}

export async function getVehicle(userId: string) {
  const profile = await findOwnProfile(userId);
  const vehicle = await Vehicle.findOne({ driverId: profile._id });
  if (!vehicle) throw new AppError(404, VEHICLE_NOT_FOUND);
  return { ...vehicle.toJSON(), vehicleImage: vehicle.vehicleImage ?? null };
}

export async function updateVehicle(userId: string, changes: Partial<VehicleInput>) {
  const profile = await findOwnProfile(userId);
  const vehicle = await Vehicle.findOneAndUpdate({ driverId: profile._id }, toMongoUpdate(changes), {
    returnDocument: "after",
  }).catch(rethrowDuplicate);
  if (!vehicle) throw new AppError(404, VEHICLE_NOT_FOUND);

  await resetVerification(profile._id);
  notifyAdminsIfReadyForReview(profile._id);
  return vehicle.toJSON();
}

export async function deleteVehicle(userId: string): Promise<void> {
  const profile = await findOwnProfile(userId);
  const { deletedCount } = await Vehicle.deleteOne({ driverId: profile._id });
  if (deletedCount === 0) throw new AppError(404, VEHICLE_NOT_FOUND);
  await resetVerification(profile._id);
}

/* --------------------------------- Documents -------------------------------- */

export async function submitDocument(userId: string, input: DocumentInput) {
  const profile = await findOwnProfile(userId);
  // Status fields are not part of `input`; the schema default (PENDING) applies.
  const document = await DriverDocument.create({ ...input, driverId: profile._id }).catch(rethrowDuplicate);
  await resetVerification(profile._id);
  notifyAdminsIfReadyForReview(profile._id);
  return document.toJSON();
}

export async function listDocuments(userId: string) {
  const profile = await findOwnProfile(userId);
  const documents = await DriverDocument.find({
    $or: [{ driverId: profile._id }, { driverId: profile.userId }],
  }).sort({ documentType: 1 });
  return documents.map((doc) => doc.toJSON());
}

/**
 * Re-submits a document. Scoped by driverId, so another driver's document
 * id simply isn't found (404); we never reveal that it exists.
 */
export async function updateDocument(
  userId: string,
  documentId: string,
  changes: Partial<Pick<DocumentInput, "documentNumber" | "documentUrl">>,
) {
  const profile = await findOwnProfile(userId);

  if (changes.documentNumber !== undefined) {
    const existing = await DriverDocument.findOne({ _id: documentId, driverId: profile._id }, { documentType: 1 });
    if (!existing) throw new AppError(404, "Document not found.");
    const error = documentNumberError(existing.documentType as DocumentType, changes.documentNumber);
    if (error) throw new AppError(400, error);
  }

  const document = await DriverDocument.findOneAndUpdate(
    { _id: documentId, driverId: profile._id },
    // A changed document needs a fresh review.
    { $set: { ...changes, verificationStatus: "PENDING" }, $unset: { verifiedAt: "", rejectionReason: "" } },
    { returnDocument: "after" },
  );
  if (!document) throw new AppError(404, "Document not found.");

  await resetVerification(profile._id);
  notifyAdminsIfReadyForReview(profile._id);
  return document.toJSON();
}

/* ----------------------------- Ride History -------------------------------- */

export async function listRideHistory(userId: string) {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) return [];

  const rides = await Ride.find({ assignedDriverId: profile._id })
    .populate("passengerId", "name phone")
    .sort({ createdAt: -1 })
    .limit(30);

  return rides.map((ride) => {
    const passenger = ride.passengerId as any;
    return {
      id: String(ride._id),
      passenger: passenger?.name || "Passenger",
      route: `${ride.pickup.address} → ${ride.destination.address}`,
      pickup: ride.pickup.address,
      dropoff: ride.destination.address,
      fare: `₹${ride.estimatedFare}`,
      rawFare: ride.estimatedFare,
      status: ride.status,
      time: new Date(ride.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      date: new Date(ride.createdAt).toISOString(),
    };
  });
}

