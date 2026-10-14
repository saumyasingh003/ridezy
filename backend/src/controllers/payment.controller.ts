import type { Request, Response } from "express";
import { z } from "zod";
import * as paymentService from "../services/payment.service.js";
import { getAuthUser } from "../middlewares/auth.js";
import { DRIVER_TIP_OPTIONS, PAYMENT_METHODS, PAYMENT_STATUSES } from "../models/Payment.js";
import { objectIdSchema } from "../utils/validation.js";

/* -------------------------------- Validation -------------------------------- */

// Only the method and an optional tip choice are accepted. Amount, status or
// passengerId sent by the client are stripped: the server computes the total
// from the ride's fare plus the tip.
const payBodySchema = z.object({
  method: z.enum(PAYMENT_METHODS, { error: "Payment method must be CASH, UPI or CARD" }),
  tip: z
    .union(DRIVER_TIP_OPTIONS.map((value) => z.literal(value)), { error: "Tip must be 0, 20, 40, 50 or 60" })
    .optional(), // omitted = the tip offered on the ride
});

const rideParamsSchema = z.object({ rideId: objectIdSchema });

// What Razorpay Checkout hands the browser on success.
const razorpayVerifySchema = z.object({
  razorpay_order_id: z.string().trim().min(1).max(100),
  razorpay_payment_id: z.string().trim().min(1).max(100),
  razorpay_signature: z.string().trim().regex(/^[a-f0-9]{64}$/, "Invalid signature"),
});
const paymentParamsSchema = z.object({ paymentId: objectIdSchema });

const historyQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(PAYMENT_STATUSES, { error: "Unknown payment status" }).optional(),
});

/* -------------------------------- Controllers ------------------------------- */

/** POST /api/rides/:rideId/payment (the ride's PASSENGER) */
export async function payForRide(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { rideId } = rideParamsSchema.parse(req.params);
  const { method, tip } = payBodySchema.parse(req.body ?? {});
  const { payment, created, checkout } = await paymentService.payForRide(userId, rideId, method, tip);
  const message =
    payment.status === "COMPLETED"
      ? "Payment successful."
      : checkout
        ? "Complete the payment in Razorpay Checkout."
        : "Cash payment selected. Pay the driver; they will confirm once received.";
  // `checkout` (Razorpay only): what the browser needs to open Razorpay Checkout.
  res.status(created ? 201 : 200).json({ success: true, message, data: { ...payment, checkout } });
}

/** POST /api/payments/:paymentId/confirm-cash (the ride's DRIVER) */
export async function confirmCashPayment(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { paymentId } = paymentParamsSchema.parse(req.params);
  const data = await paymentService.confirmCashPayment(userId, paymentId);
  res.json({ success: true, message: "Cash payment confirmed.", data });
}

/** GET /api/payments/history (PASSENGER, DRIVER) */
export async function getPaymentHistory(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const query = historyQuerySchema.parse(req.query);
  const data = await paymentService.listPayments(viewer, query);
  res.json({ success: true, message: "Payments fetched successfully.", data });
}

/** GET /api/payments/:paymentId (its passenger, its driver, or ADMIN) */
export async function getPayment(req: Request, res: Response): Promise<void> {
  const viewer = getAuthUser(req);
  const { paymentId } = paymentParamsSchema.parse(req.params);
  const data = await paymentService.getPayment(viewer, paymentId);
  res.json({ success: true, message: "Payment fetched successfully.", data });
}

/** POST /api/payments/:paymentId/razorpay/verify (the payment's PASSENGER) */
export async function verifyRazorpayPayment(req: Request, res: Response): Promise<void> {
  const { userId } = getAuthUser(req);
  const { paymentId } = paymentParamsSchema.parse(req.params);
  const body = razorpayVerifySchema.parse(req.body ?? {});
  const data = await paymentService.verifyRazorpayPayment(userId, paymentId, body);
  res.json({ success: true, message: "Payment successful.", data });
}

/**
 * POST /api/payments/razorpay/webhook (Razorpay servers; no JWT).
 * Mounted in app.ts with express.raw(): the signature covers the exact bytes.
 */
export async function razorpayWebhook(req: Request, res: Response): Promise<void> {
  const signature = req.get("x-razorpay-signature") ?? "";
  const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
  const result = await paymentService.handleRazorpayWebhook(rawBody, signature);
  res.json({ success: true, message: "Webhook received.", data: result });
}
