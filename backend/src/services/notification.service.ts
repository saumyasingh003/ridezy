import { Types } from "mongoose";
import {
  Notification,
  RIDE_LIFECYCLE_TYPES,
  type NotificationDocument,
  type NotificationType,
} from "../models/Notification.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { logger } from "../utils/logger.js";
import { duplicateKeyField } from "../utils/mongo.js";
import { emitToUsers } from "../realtime/io.js";

// In-app notifications.
//
// Writing: other services call the small helpers at the bottom AFTER their
// own work has succeeded (never inside a transaction). notify() never throws:
// a failed notification is logged and must not break a ride, payment or
// verification that already happened.
//
// Delivery: every saved notification is also pushed live over Socket.IO to the
// recipient's user room ("notification:new"), so open tabs update instantly.
//
// Reading: each user only ever sees their own notifications (userId from the JWT).

/* ================================= Writing ================================= */

interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
}

/**
 * Create one notification per recipient, then push it live. Best effort: logs
 * and swallows errors. A ride lifecycle notification that already exists for
 * that recipient and ride (unique index) is silently skipped: no duplicate is
 * stored or pushed.
 */
export async function notify(userIds: (string | Types.ObjectId | null | undefined)[], input: NotifyInput): Promise<void> {
  const recipients = [...new Set(userIds.filter(Boolean).map(String))];
  const rideId = RIDE_LIFECYCLE_TYPES.includes(input.type) ? input.data?.rideId : undefined;

  await Promise.all(
    recipients.map(async (userId) => {
      let saved: NotificationDocument;
      try {
        saved = await Notification.create({ userId, ...input, data: input.data ?? {}, ...(rideId ? { rideId } : {}) });
      } catch (err) {
        if (duplicateKeyField(err)) return; // already notified about this ride event
        logger.error(`Failed to create ${input.type} notification`, err);
        return;
      }
      try {
        emitToUsers([userId], "notification:new", { notification: toView(saved), unreadCount: await unreadCountOf(userId) });
      } catch (err) {
        logger.error(`Failed to push ${input.type} notification`, err);
      }
    }),
  );
}

/** Keeps the badge in sync on all of the user's tabs after reads. */
async function pushUnreadCount(userId: string): Promise<void> {
  try {
    emitToUsers([userId], "notification:unread-count", { unreadCount: await unreadCountOf(userId) });
  } catch (err) {
    logger.error("Failed to push unread count", err);
  }
}

function unreadCountOf(userId: string): Promise<number> {
  return Notification.countDocuments({ userId: new Types.ObjectId(userId), readAt: null });
}

/**
 * Run a notification task without making the caller wait. Any error (including
 * a lookup before notify()) is logged, never thrown, and never left as an
 * unhandled promise rejection, which could crash the server.
 */
export function inBackground(task: () => Promise<unknown>): void {
  try {
    task().catch((err) => logger.error("Background notification task failed", err));
  } catch (err) {
    logger.error("Background notification task failed", err);
  }
}

/** Notify every admin (e.g. a driver is ready for review). */
export async function notifyAdmins(input: NotifyInput): Promise<void> {
  try {
    const admins = await User.find({ role: "ADMIN" }, { _id: 1 });
    await notify(admins.map((a) => String(a._id)), input);
  } catch (err) {
    logger.error(`Failed to notify admins (${input.type})`, err);
  }
}

/* ================================= Reading ================================= */

function toView(n: NotificationDocument) {
  const data = (n.data ?? {}) as Record<string, string>;
  return {
    id: n.id as string,
    recipientId: String(n.userId),
    rideId: n.rideId ? String(n.rideId) : (data.rideId ?? null),
    type: n.type,
    title: n.title,
    message: n.body,
    /** Same as `message` (kept for existing clients). */
    body: n.body,
    data,
    isRead: n.readAt !== null && n.readAt !== undefined,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  };
}

export interface ListQuery {
  page: number;
  limit: number;
  unreadOnly: boolean;
}

/** GET /api/notifications/unread-count */
export async function getUnreadCount(userId: string) {
  return { unreadCount: await unreadCountOf(userId) };
}

/** GET /api/notifications: newest first, plus the unread count for the badge. */
export async function listNotifications(userId: string, { page, limit, unreadOnly }: ListQuery) {
  const owner = new Types.ObjectId(userId);
  const filter = unreadOnly ? { userId: owner, readAt: null } : { userId: owner };

  const [total, items, unreadCount] = await Promise.all([
    Notification.countDocuments(filter),
    Notification.find(filter).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments({ userId: owner, readAt: null }),
  ]);

  return {
    notifications: items.map(toView),
    unreadCount,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

/**
 * PATCH /api/notifications/:id/read: the owner only (anyone else gets 404).
 * Idempotent: an already-read notification keeps its original readAt.
 */
export async function markRead(userId: string, notificationId: string) {
  const owner = new Types.ObjectId(userId);
  const updated =
    (await Notification.findOneAndUpdate(
      { _id: notificationId, userId: owner, readAt: null },
      { $set: { readAt: new Date() } },
      { returnDocument: "after" },
    )) ?? (await Notification.findOne({ _id: notificationId, userId: owner }));
  if (!updated) throw new AppError(404, "Notification not found.");
  void pushUnreadCount(userId);
  return toView(updated);
}

/** PATCH /api/notifications/read-all: returns how many were newly marked. */
export async function markAllRead(userId: string) {
  const result = await Notification.updateMany(
    { userId: new Types.ObjectId(userId), readAt: null },
    { $set: { readAt: new Date() } },
  );
  if (result.modifiedCount > 0) void pushUnreadCount(userId);
  return { updated: result.modifiedCount };
}

/* ============================ Event helpers ================================ */
// One place for wording, so every screen says the same thing.

export const notifications = {
  rideAccepted: (passengerId: unknown, rideId: string, driverName: string) =>
    notify([String(passengerId)], {
      type: "RIDE_ACCEPTED",
      title: "Driver on the way",
      body: `${driverName} accepted your ride and is heading to your pickup.`,
      data: { rideId },
    }),
  driverApproaching: (passengerId: unknown, rideId: string, driverName: string, etaMinutes: number) =>
    notify([String(passengerId)], {
      type: "DRIVER_APPROACHING",
      title: "Driver approaching",
      body: `${driverName} is about ${etaMinutes} min away. Please be ready at the pickup point.`,
      data: { rideId },
    }),
  driverArrived: (passengerId: unknown, rideId: string, driverName: string) =>
    notify([String(passengerId)], {
      type: "DRIVER_ARRIVED",
      title: "Your driver has arrived",
      body: `${driverName} is at the pickup point. Share your ride OTP once you're in the vehicle.`,
      data: { rideId },
    }),
  rideStarted: (passengerId: unknown, rideId: string) =>
    notify([String(passengerId)], {
      type: "RIDE_STARTED",
      title: "Trip started",
      body: "Your trip is under way. Have a safe ride!",
      data: { rideId },
    }),
  rideCompleted: (passengerId: unknown, rideId: string, fare: number) =>
    notify([String(passengerId)], {
      type: "RIDE_COMPLETED",
      title: "You've arrived",
      body: `Trip complete. Fare: ₹${fare}. Pay now and rate your driver.`,
      data: { rideId },
    }),
  noDriverFound: (passengerId: unknown, rideId: string) =>
    notify([String(passengerId)], {
      type: "RIDE_NO_DRIVER",
      title: "No driver found",
      body: "No driver accepted your ride in time. Please try booking again.",
      data: { rideId },
    }),
  rideCancelled: (driverUserId: unknown, rideId: string) =>
    notify([String(driverUserId)], {
      type: "RIDE_CANCELLED",
      title: "Ride cancelled",
      body: "The passenger cancelled the ride. You're available for new requests.",
      data: { rideId },
    }),
  paymentReceived: (driverUserId: unknown, rideId: string, paymentId: string, amount: number, method: string, tip = 0) =>
    notify([String(driverUserId)], {
      type: "PAYMENT_RECEIVED",
      title: tip > 0 ? "Payment received + tip" : "Payment received",
      body: tip > 0 ? `₹${amount} received via ${method}, including a ₹${tip} tip.` : `₹${amount} received via ${method}.`,
      data: { rideId, paymentId },
    }),
  cashConfirmed: (passengerId: unknown, rideId: string, paymentId: string, amount: number) =>
    notify([String(passengerId)], {
      type: "PAYMENT_CONFIRMED",
      title: "Cash payment confirmed",
      body: `Your driver confirmed receiving ₹${amount} in cash. You can rate your trip now.`,
      data: { rideId, paymentId },
    }),
  newRating: (driverUserId: unknown, rideId: string, score: number) =>
    notify([String(driverUserId)], {
      type: "NEW_RATING",
      title: "New rating",
      body: `A rider rated your trip ${score} out of 5.`,
      data: { rideId },
    }),
  driverVerified: (driverUserId: unknown) =>
    notify([String(driverUserId)], {
      type: "DRIVER_VERIFIED",
      title: "You're verified!",
      body: "Your documents were approved. You can now go online and accept rides.",
    }),
  driverRejected: (driverUserId: unknown, reason: string) =>
    notify([String(driverUserId)], {
      type: "DRIVER_REJECTED",
      title: "Verification not approved",
      body: `Reason: ${reason}. Update your details and resubmit.`,
    }),
  driverReadyForReview: (driverName: string, driverProfileId: string) =>
    notifyAdmins({
      type: "DRIVER_READY_FOR_REVIEW",
      title: "Driver ready for review",
      body: `${driverName} submitted a vehicle and all documents.`,
      data: { driverId: driverProfileId },
    }),
};
