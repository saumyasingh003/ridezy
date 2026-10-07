import { Types } from "mongoose";
import { PassengerProfile, MAX_SAVED_PLACES, type PassengerProfileDocument } from "../models/PassengerProfile.js";
import type { Gender } from "../models/shared.js";
import { AppError } from "../utils/AppError.js";
import { duplicateKeyField, toMongoUpdate } from "../utils/mongo.js";
import { getUserContact, setUserPhone } from "./user.service.js";

export interface PassengerProfileInput {
  phone?: string;
  profileImage?: string | null;
  dateOfBirth?: Date | null;
  gender?: Gender | null;
}

export interface SavedPlaceInput {
  type: "HOME" | "WORK" | "OTHER";
  label: string;
  address: string;
  latitude: number;
  longitude: number;
}

const NOT_FOUND = "Passenger profile not found. Create one first.";
const PLACE_NOT_FOUND = "Saved place not found.";

/** Profile + the contact details that live on User. */
async function toView(profile: PassengerProfileDocument) {
  const { userId: _userId, ...rest } = profile.toJSON();
  return { ...rest, ...(await getUserContact(profile.userId)) };
}

async function findOwnProfile(userId: string): Promise<PassengerProfileDocument> {
  const profile = await PassengerProfile.findOne({ userId });
  if (!profile) throw new AppError(404, NOT_FOUND);
  return profile;
}

export async function createProfile(userId: string, input: PassengerProfileInput) {
  if (await PassengerProfile.exists({ userId })) {
    throw new AppError(409, "Passenger profile already exists. Use PATCH to update it.");
  }

  const { phone, ...fields } = input;
  await setUserPhone(userId, phone);

  try {
    const profile = await PassengerProfile.create({ ...fields, userId });
    return toView(profile);
  } catch (err) {
    // A parallel request created it between our check and insert.
    if (duplicateKeyField(err) === "userId") throw new AppError(409, "Passenger profile already exists.");
    throw err;
  }
}

export async function getProfile(userId: string) {
  return toView(await findOwnProfile(userId));
}

export async function updateProfile(userId: string, input: PassengerProfileInput) {
  const { phone, ...fields } = input;
  await findOwnProfile(userId);
  await setUserPhone(userId, phone);

  const update = toMongoUpdate(fields);
  const profile = Object.keys(update).length
    ? await PassengerProfile.findOneAndUpdate({ userId }, update, { returnDocument: "after" })
    : await PassengerProfile.findOne({ userId });

  return toView(profile ?? (await findOwnProfile(userId)));
}

export async function deleteProfile(userId: string): Promise<void> {
  const { deletedCount } = await PassengerProfile.deleteOne({ userId });
  if (deletedCount === 0) throw new AppError(404, NOT_FOUND);
}

/**
 * Adds a place in ONE atomic update whose filter encodes the rules:
 *  - at most one HOME and one WORK
 *  - at most MAX_SAVED_PLACES places ("savedPlaces.N" exists only if there are N+1)
 * If the filter matches nothing, we re-read the profile to say which rule failed.
 */
export async function addSavedPlace(userId: string, place: SavedPlaceInput) {
  const filter = {
    userId,
    [`savedPlaces.${MAX_SAVED_PLACES - 1}`]: { $exists: false },
    ...(place.type !== "OTHER" ? { "savedPlaces.type": { $ne: place.type } } : {}),
  };

  const profile = await PassengerProfile.findOneAndUpdate(
    filter,
    { $push: { savedPlaces: place } },
    { returnDocument: "after" },
  );

  if (!profile) {
    const existing = await findOwnProfile(userId);
    if (existing.savedPlaces.length >= MAX_SAVED_PLACES) {
      throw new AppError(400, `You can save at most ${MAX_SAVED_PLACES} places.`);
    }
    throw new AppError(409, `You already have a ${place.type} place. Update it instead.`);
  }

  return toView(profile);
}

export async function updateSavedPlace(userId: string, placeId: string, changes: Partial<SavedPlaceInput>) {
  const _id = new Types.ObjectId(placeId);
  const filter: Record<string, unknown> = { userId, "savedPlaces._id": _id };

  // Switching to HOME/WORK: no *other* place of that type may exist.
  if (changes.type && changes.type !== "OTHER") {
    filter.savedPlaces = { $not: { $elemMatch: { type: changes.type, _id: { $ne: _id } } } };
  }

  const profile = await PassengerProfile.findOneAndUpdate(filter, toMongoUpdate(changes, "savedPlaces.$[place]."), {
    arrayFilters: [{ "place._id": _id }],
    returnDocument: "after",
    runValidators: true,
  });

  if (!profile) {
    const existing = await findOwnProfile(userId);
    if (!existing.savedPlaces.id(_id)) throw new AppError(404, PLACE_NOT_FOUND);
    throw new AppError(409, `You already have a ${changes.type} place.`);
  }

  return toView(profile);
}

export async function deleteSavedPlace(userId: string, placeId: string) {
  const _id = new Types.ObjectId(placeId);
  const profile = await PassengerProfile.findOneAndUpdate(
    { userId, "savedPlaces._id": _id },
    { $pull: { savedPlaces: { _id } } },
    { returnDocument: "after" },
  );

  if (!profile) {
    await findOwnProfile(userId); // 404 for "no profile" first
    throw new AppError(404, PLACE_NOT_FOUND);
  }

  return toView(profile);
}
