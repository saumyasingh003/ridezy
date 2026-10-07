import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";

export const adminRouter = Router();

// Every route below: valid JWT + ADMIN role.
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/drivers/pending-verification", admin.listPendingDrivers);
adminRouter.get("/drivers/nearby", admin.nearbyDrivers);
adminRouter.patch("/drivers/:driverId/verify", admin.verifyDriver);
adminRouter.patch("/drivers/:driverId/reject", admin.rejectDriver);
