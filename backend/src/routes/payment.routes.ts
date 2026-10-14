import { Router } from "express";
import * as payment from "../controllers/payment.controller.js";
import { requireAuth } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/role.js";

// Mounted at /api/payments. Paying for a ride lives on the ride router
// (POST /api/rides/:rideId/payment). Ownership is checked in the service.
export const paymentRouter = Router();

paymentRouter.use(requireAuth);

// "/history" must come before "/:paymentId"
paymentRouter.get("/history", requireRole("PASSENGER", "DRIVER"), payment.getPaymentHistory);
paymentRouter.post("/:paymentId/confirm-cash", requireRole("DRIVER"), payment.confirmCashPayment);
// Razorpay Checkout success callback (the webhook is mounted in app.ts: it needs the raw body and no JWT).
paymentRouter.post("/:paymentId/razorpay/verify", requireRole("PASSENGER"), payment.verifyRazorpayPayment);
paymentRouter.get("/:paymentId", requireRole("PASSENGER", "DRIVER", "ADMIN"), payment.getPayment);
