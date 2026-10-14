import { Router } from "express";
import * as ride from "../controllers/ride.controller.js";
import { payForRide } from "../controllers/payment.controller.js";
import * as communication from "../controllers/rideCommunication.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";
import { bookingLimiter, estimateLimiter } from "../middlewares/rateLimit.js";

// Mounted at /api/rides. Roles differ per route; ownership (my ride / offered
// to me) is checked in the service, with identity always taken from the JWT.
export const rideRouter = Router();

rideRouter.use(requireAuth);

// Passenger
rideRouter.post("/estimate", requireRole("PASSENGER"), estimateLimiter, ride.estimate);
rideRouter.get("/nearby-drivers", requireRole("PASSENGER"), estimateLimiter, ride.nearbyDrivers);
rideRouter.post("/", requireRole("PASSENGER"), bookingLimiter, ride.bookRide);
rideRouter.patch("/:rideId/cancel", requireRole("PASSENGER"), ride.cancelRide);
rideRouter.patch("/:rideId/tip", requireRole("PASSENGER"), ride.setRideTip);
rideRouter.post("/:rideId/match", requireRole("PASSENGER"), estimateLimiter, ride.restartMatching);
rideRouter.get("/:rideId/driver", requireRole("PASSENGER"), ride.getAssignedDriver);
rideRouter.post("/:rideId/payment", requireRole("PASSENGER"), payForRide);

// Driver
rideRouter.post("/:rideId/accept", requireRole("DRIVER"), ride.acceptRide);
rideRouter.post("/:rideId/reject", requireRole("DRIVER"), ride.rejectRide);
rideRouter.post("/:rideId/arrive", requireRole("DRIVER"), ride.arriveAtPickup);
rideRouter.post("/:rideId/start", requireRole("DRIVER"), ride.startRide);
rideRouter.post("/:rideId/complete", requireRole("DRIVER"), ride.completeRide);

// Shared ("/current" and "/history" must come before "/:rideId")
rideRouter.get("/current", requireRole("PASSENGER", "DRIVER"), ride.getCurrentRide);
rideRouter.get("/history", requireRole("PASSENGER", "DRIVER"), ride.getRideHistory);
rideRouter.get("/:rideId", requireRole("PASSENGER", "DRIVER", "ADMIN"), ride.getRide);

// Chat & calls: participants only (checked in the service). Sending and calling
// happen over Socket.IO; see docs/realtime-events.md.
rideRouter.get("/:rideId/communication", requireRole("PASSENGER", "DRIVER"), communication.getCommunicationStatus);
rideRouter.get("/:rideId/messages", requireRole("PASSENGER", "DRIVER"), communication.listMessages);

// Ratings: only the rider rates the driver, any time after paying
rideRouter.post("/:rideId/rating", requireRole("PASSENGER"), ride.rateRide);
rideRouter.get("/:rideId/rating", requireRole("PASSENGER", "DRIVER", "ADMIN"), ride.getRideRatings);
