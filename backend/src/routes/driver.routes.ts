import { Router } from "express";
import * as driver from "../controllers/driver.controller.js";
import { listRideRequests } from "../controllers/ride.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";

export const driverRouter = Router();

// Every route below: valid JWT + DRIVER role. Each acts on the caller's own
// profile (found via the JWT), so there is no way to address another driver.
driverRouter.use(requireAuth, requireRole("DRIVER"));

driverRouter.post("/profile", driver.createProfile);
driverRouter.get("/profile", driver.getProfile);
driverRouter.patch("/profile", driver.updateProfile);

driverRouter.post("/vehicle", driver.addVehicle);
driverRouter.get("/vehicle", driver.getVehicle);
driverRouter.patch("/vehicle", driver.updateVehicle);
driverRouter.delete("/vehicle", driver.deleteVehicle);

driverRouter.post("/documents", driver.submitDocument);
driverRouter.get("/documents", driver.listDocuments);
driverRouter.patch("/documents/:documentId", driver.updateDocument);

// Pending ride offers for this driver (Step 5 will also push them over Socket.IO).
driverRouter.get("/rides/requests", listRideRequests);
