import { Router } from "express";
import * as admin from "../controllers/admin.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";

export const adminRouter = Router();

// Every route below: valid JWT + ADMIN role.
adminRouter.use(requireAuth, requireRole("ADMIN"));

adminRouter.get("/stats", admin.getAdminStats);
adminRouter.get("/customers", admin.listCustomers);
adminRouter.get("/drivers", admin.listAllDrivers);
adminRouter.get("/reviews", admin.listReviews);
adminRouter.get("/drivers/pending-verification", admin.listPendingDrivers);
adminRouter.get("/drivers/nearby", admin.nearbyDrivers);
adminRouter.get("/drivers/:driverId", admin.getDriverDetails);
adminRouter.patch("/drivers/:driverId/verify", admin.verifyDriver);
adminRouter.patch("/drivers/:driverId/reject", admin.rejectDriver);
adminRouter.patch("/drivers/:driverId", admin.updateDriverProfile);
adminRouter.delete("/drivers/:driverId", admin.deleteDriverProfile);
adminRouter.post("/drivers/:driverId/documents", admin.submitDriverDocument);
adminRouter.patch("/drivers/:driverId/documents/:documentId/status", admin.updateDriverDocumentStatus);
adminRouter.delete("/drivers/:driverId/documents/:documentId", admin.deleteDriverDocument);
adminRouter.patch("/drivers/:driverId/suspend", admin.suspendDriver);
adminRouter.patch("/drivers/:driverId/activate", admin.activateDriver);
adminRouter.get("/rides", admin.listAllRides);
adminRouter.get("/rides/active", admin.listActiveRides);
adminRouter.get("/payments", admin.listAllPayments);
adminRouter.get("/analytics", admin.getAnalytics);
adminRouter.get("/audit-logs", admin.listAuditLogs);
