import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { cleanJSON } from "./shared.js";

/** Every kind of in-app notification. Clients use it for icons and deep links. */
export const NOTIFICATION_TYPES = [
  // Passenger
  "RIDE_ACCEPTED",
  "DRIVER_APPROACHING",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "RIDE_COMPLETED",
  "RIDE_NO_DRIVER",
  "PAYMENT_CONFIRMED",
  // Driver
  "RIDE_CANCELLED",
  "PAYMENT_RECEIVED",
  "NEW_RATING",
  "DRIVER_VERIFIED",
  "DRIVER_REJECTED",
  // Admin
  "DRIVER_READY_FOR_REVIEW",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/**
 * Ride lifecycle events: each happens at most once per ride, so these are
 * stored with a top-level `rideId` and the unique index below rejects a
 * second copy (a retried request, a race between two servers' worth of
 * events, ...) at the database level.
 */
export const RIDE_LIFECYCLE_TYPES: readonly NotificationType[] = [
  "RIDE_ACCEPTED",
  "DRIVER_APPROACHING",
  "DRIVER_ARRIVED",
  "RIDE_STARTED",
  "RIDE_COMPLETED",
  "RIDE_CANCELLED",
  "RIDE_NO_DRIVER",
];

/** Notifications are removed automatically after this long. */
export const NOTIFICATION_TTL_DAYS = 90;

const notificationSchema = new Schema(
  {
    // The recipient (exposed as `recipientId` in the API).
    userId: { type: Types.ObjectId, ref: "User", required: true },
    // Set for ride lifecycle notifications (RIDE_LIFECYCLE_TYPES); see the unique index.
    rideId: { type: Types.ObjectId, ref: "Ride" },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body: { type: String, required: true, trim: true, maxlength: 500 },
    // Ids for deep links (e.g. { rideId }); never personal data.
    data: { type: Schema.Types.Mixed, default: {} },
    // null = unread. A date (not a boolean) also records *when* it was read.
    readAt: { type: Date, default: null },
  },
  { timestamps: true, toJSON: cleanJSON },
);

// The list: "my notifications, newest first".
notificationSchema.index({ userId: 1, createdAt: -1 });
// The badge: "how many unread do I have".
notificationSchema.index({ userId: 1, readAt: 1 });
// No duplicate lifecycle notification: one per (recipient, ride, event).
// Partial: only documents with a top-level rideId (lifecycle types) are indexed.
notificationSchema.index(
  { userId: 1, rideId: 1, type: 1 },
  { unique: true, partialFilterExpression: { rideId: { $exists: true } }, name: "one_per_ride_event" },
);
// MongoDB deletes old notifications by itself (TTL index), so the collection can't grow forever.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: NOTIFICATION_TTL_DAYS * 24 * 3600 });

export type NotificationDocument = HydratedDocument<InferSchemaType<typeof notificationSchema>>;

export const Notification = model("Notification", notificationSchema);
