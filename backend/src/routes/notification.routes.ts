import { Router } from "express";
import * as notification from "../controllers/notification.controller.js";
import { requireAuth } from "../middlewares/auth.js";

// Mounted at /api/notifications. Any signed-in user; each only ever sees and
// changes their own notifications (userId comes from the JWT).
export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get("/", notification.listNotifications);
notificationRouter.get("/unread-count", notification.getUnreadCount);
// "/read-all" must come before "/:notificationId/read"
notificationRouter.patch("/read-all", notification.markAllRead);
notificationRouter.patch("/:notificationId/read", notification.markRead);
