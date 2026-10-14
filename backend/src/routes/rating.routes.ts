import { Router } from "express";
import { getMyRatings } from "../controllers/ride.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";

// Mounted at /api/ratings. Rating a ride lives on the ride router
// (POST/GET /api/rides/:rideId/rating); this is "ratings I received".
export const ratingRouter = Router();

// Only drivers receive ratings (riders rate drivers, not the other way round).
ratingRouter.get("/me", requireAuth, requireRole("DRIVER"), getMyRatings);
