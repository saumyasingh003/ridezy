import type { Request, Response } from "express";
import { z } from "zod";
import * as notificationService from "../services/notification.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { objectIdSchema } from "../utils/validation.js";

/* -------------------------------- Validation -------------------------------- */

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  // Strict: z.coerce.boolean() would turn the string "false" into true.
  unreadOnly: z
    .enum(["true", "false"], { error: "unreadOnly must be true or false" })
    .default("false")
    .transform((v) => v === "true"),
});

const paramsSchema = z.object({ notificationId: objectIdSchema });

/* -------------------------------- Controllers ------------------------------- */

/** GET /api/notifications (any role): my notifications, newest first */
export async function listNotifications(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const query = listQuerySchema.parse(req.query);
  const data = await notificationService.listNotifications(userId, query);
  res.json({ success: true, message: "Notifications fetched successfully.", data });
}

/** GET /api/notifications/unread-count (any role): for the badge */
export async function getUnreadCount(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const data = await notificationService.getUnreadCount(userId);
  res.json({ success: true, message: "Unread count fetched successfully.", data });
}

/** PATCH /api/notifications/read-all (any role) */
export async function markAllRead(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const data = await notificationService.markAllRead(userId);
  res.json({ success: true, message: "All notifications marked as read.", data });
}

/** PATCH /api/notifications/:notificationId/read (the notification's owner) */
export async function markRead(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { notificationId } = paramsSchema.parse(req.params);
  const data = await notificationService.markRead(userId, notificationId);
  res.json({ success: true, message: "Notification marked as read.", data });
}
