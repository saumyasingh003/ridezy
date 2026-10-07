import { Router } from "express";
import { healthRouter } from "./health.routes.js";
import { authRouter } from "./auth.routes.js";
import { passengerRouter } from "./passenger.routes.js";
import { driverRouter } from "./driver.routes.js";
import { driverAvailabilityRouter } from "./driverAvailability.routes.js";
import { adminRouter } from "./admin.routes.js";
import { rideRouter } from "./ride.routes.js";
import { docsRouter } from "./docs.routes.js";

// Mounted at /api. Role guards live at the top of each feature router.
export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/docs", docsRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/passengers", passengerRouter);
apiRouter.use("/drivers", driverAvailabilityRouter); // /availability, /location
apiRouter.use("/drivers", driverRouter);
apiRouter.use("/rides", rideRouter);
apiRouter.use("/admin", adminRouter);
