import { Router } from "express";
import * as availability from "../controllers/driverAvailability.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { locationLimiter } from "../middlewares/rateLimit.js";

// Mounted at /api/drivers. Every route: valid JWT + DRIVER role, acting on the
// caller's own profile only (no ids are accepted from the client).
export const driverAvailabilityRouter = Router();

driverAvailabilityRouter.use(["/availability", "/location"], requireAuth, requireRole("DRIVER"));

driverAvailabilityRouter.patch("/availability", availability.updateAvailability);
driverAvailabilityRouter.patch("/location", locationLimiter, availability.updateLocation);
driverAvailabilityRouter.get("/location", availability.getLocation);
