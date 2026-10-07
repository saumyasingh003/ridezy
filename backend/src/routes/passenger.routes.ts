import { Router } from "express";
import * as passenger from "../controllers/passenger.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";

export const passengerRouter = Router();

// Every route below: valid JWT + PASSENGER role.
passengerRouter.use(requireAuth, requireRole("PASSENGER"));

passengerRouter.post("/profile", passenger.createProfile);
passengerRouter.get("/profile", passenger.getProfile);
passengerRouter.patch("/profile", passenger.updateProfile);
passengerRouter.delete("/profile", passenger.deleteProfile);

passengerRouter.post("/saved-places", passenger.addSavedPlace);
passengerRouter.patch("/saved-places/:placeId", passenger.updateSavedPlace);
passengerRouter.delete("/saved-places/:placeId", passenger.deleteSavedPlace);
