import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { cleanJSON } from "./shared.js";

export const MESSAGE_SENDER_ROLES = ["PASSENGER", "DRIVER"] as const;
export type MessageSenderRole = (typeof MESSAGE_SENDER_ROLES)[number];

export const MAX_MESSAGE_LENGTH = 1000;

/**
 * One chat message between a ride's passenger and its assigned driver.
 * Plain text only: clients must render `body` as text, never as HTML.
 */
const rideMessageSchema = new Schema(
  {
    rideId: { type: Types.ObjectId, ref: "Ride", required: true },
    senderId: { type: Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: MESSAGE_SENDER_ROLES, required: true },
    body: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_MESSAGE_LENGTH },
    // Client-generated id: a resend after a dropped connection returns the
    // already-saved message instead of creating a duplicate.
    clientMessageId: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false }, toJSON: cleanJSON },
);

// Chat history, newest first, paginated by _id (GET /rides/:rideId/messages).
rideMessageSchema.index({ rideId: 1, _id: -1 });

// Idempotent sends: one message per (ride, sender, clientMessageId).
rideMessageSchema.index(
  { rideId: 1, senderId: 1, clientMessageId: 1 },
  { unique: true, partialFilterExpression: { clientMessageId: { $type: "string" } }, name: "one_message_per_client_id" },
);

export type RideMessageDocument = HydratedDocument<InferSchemaType<typeof rideMessageSchema>>;

export const RideMessage = model("RideMessage", rideMessageSchema);
