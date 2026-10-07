import { Router } from "express";
import * as ride from "../controllers/ride.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { bookingLimiter, estimateLimiter } from "../middlewares/rateLimit.js";

// Mounted at /api/rides. Roles differ per route; ownership (my ride / offered
// to me) is checked in the service, with identity always taken from the JWT.
export const rideRouter = Router();

rideRouter.use(requireAuth);

// Passenger
rideRouter.post("/estimate", requireRole("PASSENGER"), estimateLimiter, ride.estimate);
rideRouter.post("/", requireRole("PASSENGER"), bookingLimiter, ride.bookRide);
rideRouter.patch("/:rideId/cancel", requireRole("PASSENGER"), ride.cancelRide);

// Driver
rideRouter.post("/:rideId/accept", requireRole("DRIVER"), ride.acceptRide);
rideRouter.post("/:rideId/reject", requireRole("DRIVER"), ride.rejectRide);

// Shared ("/current" must come before "/:rideId")
rideRouter.get("/current", requireRole("PASSENGER", "DRIVER"), ride.getCurrentRide);
rideRouter.get("/:rideId", requireRole("PASSENGER", "DRIVER", "ADMIN"), ride.getRide);
