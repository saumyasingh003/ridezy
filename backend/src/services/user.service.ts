import type { Types } from "mongoose";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { duplicateKeyField } from "../utils/mongo.js";

// Phone lives on User (single source of truth, unique index). Passenger and
// driver profiles read and write it through these helpers.

export interface UserContact {
  name: string;
  email: string;
  phone: string | null;
  createdAt?: Date;
}

export async function getUserContact(userId: string | Types.ObjectId): Promise<UserContact> {
  const user = await User.findById(userId, { name: 1, email: 1, phone: 1, createdAt: 1 });
  if (!user) throw new AppError(401, "Authentication required."); // account deleted
  return { name: user.name, email: user.email, phone: user.phone ?? null, createdAt: user.createdAt };
}

export async function setUserPhone(userId: string, phone: string | undefined): Promise<void> {
  if (phone === undefined) return;
  try {
    await User.updateOne({ _id: userId }, { $set: { phone } });
  } catch (err) {
    if (duplicateKeyField(err) === "phone") {
      throw new AppError(409, "An account with this phone number already exists.");
    }
    throw err;
  }
}
