import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "../utils/logger.js";

// Reject query filters on fields that aren't in the schema.
mongoose.set("strictQuery", true);

export async function connectDB(uri: string = env.mongodbUri): Promise<void> {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });

  // Make sure unique/TTL indexes exist before we serve traffic. Without this a
  // duplicate email could slip in while the unique index is still being built.
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));

  logger.info("✅ Connected to MongoDB");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
  logger.info("Disconnected from MongoDB");
}

export async function pingDB(): Promise<void> {
  const db = mongoose.connection.db;
  if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected || !db) {
    throw new Error("MongoDB is not connected");
  }
  await db.admin().ping();
}
