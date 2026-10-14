import { Types } from "mongoose";
import { env } from "../config/env.js";
import { CURRENCY } from "../config/fare.js";
import { DriverProfile } from "../models/DriverProfile.js";
import {
  computePaymentAmounts,
  OPEN_PAYMENT_STATUSES,
  Payment,
  type DriverTip,
  type PaymentDocument,
  type PaymentMethod,
  type PaymentStatus,
} from "../models/Payment.js";
import { Ride, type RideDocument } from "../models/Ride.js";
import { User, type Role } from "../models/User.js";
import { Rating } from "../models/Rating.js";
import { AppError } from "../utils/AppError.js";
import { emailService } from "../utils/email.js";
import { logger } from "../utils/logger.js";
import { duplicateKeyField } from "../utils/mongo.js";
import { getPaymentGateway } from "./paymentGateway.js";
import { inBackground, notifications } from "./notification.service.js";

// Payments for completed rides.
//   CASH      → PENDING until the driver confirms they received it.
//   UPI/CARD  → charged through the gateway (simulated today) → COMPLETED or FAILED.
// The amount always comes from the ride (server side), never from the client.

export interface Viewer {
  userId: string;
  role: Role;
}

const NOT_FOUND = "Payment not found.";

/* ================================== Views ================================== */

/**
 * The fare breakdown shown on receipts. `total` always equals `amount` (what
 * was charged). A tip only counts as paid once the payment is COMPLETED.
 * Payments made before tips existed have no baseFare: then the fare is the amount.
 */
export function breakdownOf(payment: PaymentDocument) {
  const tip = payment.tipAmount ?? 0;
  return {
    tipAmount: tip,
    tipPaid: tip > 0 && payment.status === "COMPLETED",
    breakdown: {
      baseFare: payment.baseFare ?? payment.amount - tip,
      tip,
      taxes: payment.taxAmount ?? 0,
      additionalCharges: payment.additionalCharges ?? 0,
      discount: payment.discountAmount ?? 0,
      total: payment.amount,
    },
  };
}

async function toPaymentView(payment: PaymentDocument, viewer: Viewer, ride?: RideDocument | null) {
  const trip = ride ?? (await Ride.findById(payment.rideId));
  const view: Record<string, unknown> = {
    id: payment.id as string,
    rideId: String(payment.rideId),
    amount: payment.amount,
    currency: payment.currency,
    method: payment.method,
    status: payment.status,
    ...breakdownOf(payment),
    provider: payment.provider,
    providerPaymentId: payment.providerPaymentId ?? null,
    failureReason: payment.failureReason ?? null,
    paidAt: payment.paidAt ?? null,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    ride: trip
      ? {
          pickup: trip.pickup.address,
          destination: trip.destination.address,
          vehicleType: trip.vehicleType,
          distanceKm: trip.distanceKm,
          completedAt: trip.completedAt ?? null,
        }
      : null,
  };
  // The driver (and admin) sees who paid; the passenger already knows.
  if (viewer.role !== "PASSENGER") {
    const passenger = await User.findById(payment.passengerId, { name: 1 });
    view.passenger = { name: passenger?.name ?? "Passenger" };
  } else {
    // The passenger sees who drove and whether they still owe a rating
    // (riders rate once the ride is paid).
    const [driverUserName, rating] = await Promise.all([
      driverNameOf(payment.driverId),
      Rating.findOne({ rideId: payment.rideId, fromRole: "PASSENGER" }, { score: 1, comment: 1 }),
    ]);
    view.driver = { name: driverUserName };
    view.myRating = rating ? { score: rating.score, comment: rating.comment ?? null } : null;
    view.canRate = payment.status === "COMPLETED" && !rating;
  }
  return view;
}

async function driverNameOf(driverProfileId: Types.ObjectId): Promise<string> {
  const profile = await DriverProfile.findById(driverProfileId, { userId: 1 });
  const user = profile ? await User.findById(profile.userId, { name: 1 }) : null;
  return user?.name ?? "your driver";
}

/* ============================== Receipt email ============================== */

/**
 * Emails the passenger a receipt once a payment is COMPLETED (online or cash).
 * Runs in the background after the payment is saved: a mail failure is logged
 * and never undoes or delays the payment. Includes a "rate your ride" link
 * when the passenger hasn't rated the driver yet.
 */
export async function emailPaymentReceipt(paymentId: string): Promise<void> {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status !== "COMPLETED") return;

  const [passenger, ride, driverName, rating] = await Promise.all([
    User.findById(payment.passengerId, { name: 1, email: 1 }),
    Ride.findById(payment.rideId),
    driverNameOf(payment.driverId),
    Rating.exists({ rideId: payment.rideId, fromRole: "PASSENGER" }),
  ]);
  if (!passenger?.email || !ride) {
    logger.warn(`Receipt for payment ${paymentId} not emailed: passenger email or ride missing.`);
    return;
  }

  await emailService.sendPaymentReceiptEmail(passenger.email, {
    passengerName: passenger.name,
    driverName,
    receiptNumber: (payment.id as string).slice(-8).toUpperCase(), // same as the in-app receipt
    amount: payment.amount,
    breakdown: breakdownOf(payment).breakdown,
    currency: payment.currency,
    method: payment.method,
    paidAt: payment.paidAt ?? new Date(),
    pickup: ride.pickup.address,
    destination: ride.destination.address,
    vehicleType: ride.vehicleType,
    distanceKm: ride.distanceKm,
    ...(rating ? {} : { rateUrl: `${env.appUrl}/dashboard/history` }),
  });
}

/* ================================ Pay a ride =============================== */

/**
 * POST /api/rides/:rideId/payment: the ride's passenger pays a completed ride.
 * Idempotent for a pending cash payment; switching away from pending cash
 * closes that attempt first. The partial unique index stops double payment.
 */
/** `tip` omitted = the tip the passenger offered on the ride (0 if none). */
export async function payForRide(passengerId: string, rideId: string, method: PaymentMethod, requestedTip?: DriverTip) {
  const ride = await Ride.findOne({ _id: rideId, passengerId });
  if (!ride) throw new AppError(404, "Ride not found.");
  if (ride.status !== "RIDE_COMPLETED") throw new AppError(409, "You can pay once the ride is completed.");
  if (!ride.assignedDriverId) throw new AppError(409, "This ride has no driver to pay.");

  const viewer: Viewer = { userId: passengerId, role: "PASSENGER" };
  const tip = requestedTip ?? ((ride.tipAmount ?? 0) as DriverTip);
  // Upfront pricing: the finalized fare (set on completion) plus the chosen tip.
  const amounts = computePaymentAmounts(ride.finalFare ?? ride.estimatedFare, tip);
  const open = await Payment.findOne({ rideId: ride._id, status: { $in: OPEN_PAYMENT_STATUSES } });
  if (open?.status === "COMPLETED") throw new AppError(409, "This ride is already paid.");
  if (open?.status === "PENDING") {
    if (open.method === method && (open.tipAmount ?? 0) === tip) {
      // Same choice again (e.g. Checkout was closed): reuse the attempt and its Razorpay order.
      return { payment: await toPaymentView(open, viewer, ride), created: false, checkout: await checkoutFor(open) };
    }
    if (open.method === method && method === "CASH") {
      // Same method (cash), new tip: update the pending amount, only while it is still pending.
      const retipped = await Payment.findOneAndUpdate(
        { _id: open._id, status: "PENDING" },
        { $set: amounts },
        { returnDocument: "after", runValidators: true },
      );
      if (!retipped) throw new AppError(409, "Payment state changed. Please refresh.");
      return { payment: await toPaymentView(retipped, viewer, ride), created: false, checkout: null };
    }
    // Switching method, or a new tip on an online order (its amount is fixed):
    // close the pending attempt (only if still pending) and start a new one.
    await Payment.updateOne(
      { _id: open._id, status: "PENDING" },
      { $set: { status: "FAILED", failureReason: open.method === method ? "Tip changed." : `Switched to ${method}.` } },
    );
  }

  const gateway = getPaymentGateway();
  let payment: PaymentDocument;
  try {
    payment = await Payment.create({
      rideId: ride._id,
      passengerId,
      driverId: ride.assignedDriverId,
      ...amounts,
      currency: CURRENCY,
      method,
      status: "PENDING",
      provider: method === "CASH" ? "CASH" : gateway.name,
    });
  } catch (err) {
    if (duplicateKeyField(err) === "rideId") throw new AppError(409, "A payment for this ride is already in progress.");
    throw err;
  }

  // Cash waits for the driver's confirmation.
  if (method === "CASH") return { payment: await toPaymentView(payment, viewer, ride), created: true, checkout: null };

  // Razorpay: create the order; the browser completes it in Checkout.
  if (gateway.kind === "checkout") {
    try {
      const { orderId } = await gateway.createOrder({
        amountPaise: Math.round(payment.amount * 100),
        currency: payment.currency,
        receipt: payment.id as string,
        notes: { paymentId: payment.id as string, rideId: String(ride._id) },
      });
      payment.providerOrderId = orderId;
      await payment.save();
    } catch (err) {
      logger.error("Razorpay order creation failed", err);
      await Payment.updateOne(
        { _id: payment._id, status: "PENDING" },
        { $set: { status: "FAILED", failureReason: "Could not start the payment." } },
      );
      throw new AppError(502, "Couldn't start the payment with Razorpay. Please try again.");
    }
    return { payment: await toPaymentView(payment, viewer, ride), created: true, checkout: await checkoutFor(payment) };
  }

  // Instant (simulated) gateway.
  const result = await gateway.charge({
    amount: payment.amount,
    currency: payment.currency,
    method,
    reference: payment.id as string,
  });
  if (result.status === "FAILED") {
    await Payment.updateOne(
      { _id: payment._id, status: "PENDING" },
      { $set: { status: "FAILED", providerPaymentId: result.providerPaymentId, failureReason: result.failureReason } },
    );
    throw new AppError(402, `Payment failed: ${result.failureReason}. Try again or choose another method.`);
  }
  const settled = await markPaid(payment._id, result.providerPaymentId);
  if (!settled) throw new AppError(409, "Payment state changed. Please refresh.");
  return { payment: await toPaymentView(settled, viewer, ride), created: true, checkout: null };
}

/**
 * PENDING → COMPLETED, exactly once (conditional update), then the receipt
 * email and the driver's notification. Shared by the instant gateway, the
 * Razorpay Checkout callback and the Razorpay webhook: whichever arrives
 * first wins; the others find it already paid and change nothing.
 */
async function markPaid(paymentId: Types.ObjectId | string, providerPaymentId: string) {
  const settled = await Payment.findOneAndUpdate(
    { _id: paymentId, status: "PENDING" },
    { $set: { status: "COMPLETED", providerPaymentId, paidAt: new Date() }, $unset: { failureReason: "" } },
    { returnDocument: "after" },
  );
  if (!settled) return null;

  inBackground(() => emailPaymentReceipt(settled.id as string));
  inBackground(() =>
    DriverProfile.findById(settled.driverId, { userId: 1 }).then((driver) => {
      if (driver) {
        return notifications.paymentReceived(
          driver.userId,
          String(settled.rideId),
          settled.id as string,
          settled.amount,
          settled.method,
          settled.tipAmount ?? 0,
        );
      }
    }),
  );
  return settled;
}

/* ================================ Razorpay ================================= */

/** What the browser needs to open Razorpay Checkout for a pending online payment. */
async function checkoutFor(payment: PaymentDocument) {
  const gateway = getPaymentGateway();
  if (gateway.kind !== "checkout" || payment.provider !== "RAZORPAY" || !payment.providerOrderId) return null;
  const passenger = await User.findById(payment.passengerId, { name: 1, email: 1, phone: 1 });
  return {
    provider: "RAZORPAY" as const,
    keyId: gateway.keyId,
    orderId: payment.providerOrderId,
    amount: Math.round(payment.amount * 100), // paise
    currency: payment.currency,
    name: "Ridezy",
    description: `Ride payment${payment.tipAmount ? ` (incl. ₹${payment.tipAmount} tip)` : ""}`,
    prefill: { name: passenger?.name ?? "", email: passenger?.email ?? "", contact: passenger?.phone ?? "" },
  };
}

/**
 * Checks that a Razorpay payment really is ours and paid: right order, exact
 * amount and currency, captured (an authorized one is captured here).
 * Returns the Razorpay payment id to store, or throws.
 */
async function confirmWithRazorpay(payment: PaymentDocument, providerPaymentId: string): Promise<string> {
  const gateway = getPaymentGateway();
  if (gateway.kind !== "checkout") throw new AppError(409, "Online payments are not enabled.");
  const expectedPaise = Math.round(payment.amount * 100);

  let remote = await gateway.fetchPayment(providerPaymentId);
  if (remote.orderId !== payment.providerOrderId) throw new AppError(400, "This Razorpay payment belongs to another order.");
  if (remote.amountPaise !== expectedPaise || remote.currency !== payment.currency) {
    logger.error(`Razorpay amount mismatch for payment ${payment.id}: got ${remote.amountPaise} ${remote.currency}`);
    throw new AppError(400, "The amount paid does not match this ride.");
  }
  if (remote.status === "authorized") remote = await gateway.capturePayment(remote.id, expectedPaise, payment.currency);
  if (remote.status !== "captured") {
    throw new AppError(402, `Payment not completed${remote.errorDescription ? `: ${remote.errorDescription}` : ""}.`);
  }
  return remote.id;
}

export interface CheckoutResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * POST /api/payments/:paymentId/razorpay/verify: the Checkout success
 * callback. Only the payment's passenger; the signature proves the ids came
 * from Razorpay, and the payment is re-checked with Razorpay's API.
 */
export async function verifyRazorpayPayment(passengerId: string, paymentId: string, result: CheckoutResult) {
  const gateway = getPaymentGateway();
  const payment = await Payment.findOne({ _id: paymentId, passengerId });
  if (!payment) throw new AppError(404, NOT_FOUND);
  const viewer: Viewer = { userId: passengerId, role: "PASSENGER" };

  if (payment.status === "COMPLETED") {
    // Already confirmed (e.g. by the webhook first): idempotent success.
    if (payment.providerPaymentId === result.razorpay_payment_id) return toPaymentView(payment, viewer);
    throw new AppError(409, "This ride is already paid.");
  }
  if (payment.status !== "PENDING" || payment.provider !== "RAZORPAY" || gateway.kind !== "checkout") {
    throw new AppError(409, "This payment can no longer be completed. Start a new payment.");
  }
  if (result.razorpay_order_id !== payment.providerOrderId) throw new AppError(400, "Order does not match this payment.");
  if (!gateway.verifyCheckoutSignature(result.razorpay_order_id, result.razorpay_payment_id, result.razorpay_signature)) {
    throw new AppError(400, "Payment signature is invalid.");
  }

  const providerPaymentId = await confirmWithRazorpay(payment, result.razorpay_payment_id);
  const settled = (await markPaid(payment._id, providerPaymentId)) ?? (await Payment.findById(payment._id));
  if (!settled || settled.status !== "COMPLETED") throw new AppError(409, "Payment state changed. Please refresh.");
  return toPaymentView(settled, viewer);
}

/**
 * POST /api/payments/razorpay/webhook (called by Razorpay, no JWT). The
 * signature over the raw body proves it is Razorpay. Handles:
 *   payment.captured / order.paid → mark paid (same checks as verify)
 *   payment.failed                → note the reason; the payment stays PENDING
 *                                   because Checkout lets the passenger retry
 *                                   the same order.
 * Unknown events and payments that are not ours are acknowledged and ignored,
 * so Razorpay does not keep retrying them.
 */
export async function handleRazorpayWebhook(rawBody: Buffer, signature: string): Promise<{ handled: string }> {
  const gateway = getPaymentGateway();
  if (gateway.kind !== "checkout") throw new AppError(404, "Razorpay is not enabled.");
  if (!gateway.verifyWebhookSignature(rawBody, signature)) throw new AppError(400, "Invalid webhook signature.");

  const event = JSON.parse(rawBody.toString("utf8")) as {
    event?: string;
    payload?: { payment?: { entity?: Record<string, unknown> }; order?: { entity?: Record<string, unknown> } };
  };
  const entity = event.payload?.payment?.entity;
  const orderId = String(entity?.order_id ?? event.payload?.order?.entity?.id ?? "");
  if (!orderId) return { handled: "ignored" };

  const payment = await Payment.findOne({ providerOrderId: orderId });
  if (!payment || payment.status !== "PENDING") return { handled: "ignored" };

  if ((event.event === "payment.captured" || event.event === "order.paid") && entity?.id) {
    try {
      const providerPaymentId = await confirmWithRazorpay(payment, String(entity.id));
      await markPaid(payment._id, providerPaymentId);
      return { handled: "paid" };
    } catch (err) {
      logger.error(`Razorpay webhook for order ${orderId} not applied`, err);
      return { handled: "rejected" };
    }
  }
  if (event.event === "payment.failed") {
    await Payment.updateOne(
      { _id: payment._id, status: "PENDING" },
      { $set: { failureReason: String(entity?.error_description ?? "Payment failed.") } },
    );
    return { handled: "failed-attempt" };
  }
  return { handled: "ignored" };
}

/* ============================== Confirm cash =============================== */

/** POST /api/payments/:paymentId/confirm-cash: the ride's driver received the cash. */
export async function confirmCashPayment(userId: string, paymentId: string) {
  const profile = await DriverProfile.findOne({ userId });
  if (!profile) throw new AppError(404, "Driver profile not found. Create one first.");

  const payment = await Payment.findOne({ _id: paymentId, driverId: profile._id });
  if (!payment) throw new AppError(404, NOT_FOUND);
  if (payment.method !== "CASH") throw new AppError(409, "Only cash payments are confirmed by the driver.");

  const confirmed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: "PENDING" },
    { $set: { status: "COMPLETED", paidAt: new Date() } },
    { returnDocument: "after" },
  );
  if (!confirmed) {
    throw new AppError(409, payment.status === "COMPLETED" ? "This payment is already confirmed." : "This payment is no longer pending.");
  }
  inBackground(() => emailPaymentReceipt(confirmed.id as string));
  inBackground(() => notifications.cashConfirmed(confirmed.passengerId, String(confirmed.rideId), confirmed.id as string, confirmed.amount));
  return toPaymentView(confirmed, { userId, role: "DRIVER" });
}

/* ================================= Reading ================================= */

export interface PaymentHistoryQuery {
  page: number;
  limit: number;
  status?: PaymentStatus;
}

/** GET /api/payments/history: payments made (passenger) or received (driver), newest first. */
export async function listPayments(viewer: Viewer, { page, limit, status }: PaymentHistoryQuery) {
  const filter: Record<string, unknown> = {};
  if (viewer.role === "DRIVER") {
    const profile = await DriverProfile.findOne({ userId: viewer.userId });
    if (!profile) return { payments: [], summary: emptySummary(), pagination: { page, limit, total: 0, pages: 0 } };
    filter.driverId = Types.ObjectId.isValid(profile._id)
      ? new Types.ObjectId(profile._id)
      : profile._id;
  } else {
    filter.passengerId = Types.ObjectId.isValid(viewer.userId)
      ? new Types.ObjectId(viewer.userId)
      : viewer.userId;
  }
  const listFilter = status ? { ...filter, status } : filter;

  const [total, payments, totals] = await Promise.all([
    Payment.countDocuments(listFilter),
    Payment.find(listFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Payment.aggregate<{ _id: string; amount: number; tips: number; count: number }>([
      { $match: filter },
      {
        $group: {
          _id: "$status",
          amount: { $sum: "$amount" },
          tips: { $sum: { $ifNull: ["$tipAmount", 0] } },
          count: { $sum: 1 },
        },
      },
    ]),
  ]);

  const byStatus = (s: string) => totals.find((t) => t._id === s);
  const paid = byStatus("COMPLETED");
  return {
    payments: await Promise.all(payments.map((p) => toPaymentView(p, viewer))),
    // Totals across all pages (paid = COMPLETED, pending = awaiting cash confirmation).
    summary: {
      currency: CURRENCY,
      paidAmount: paid?.amount ?? 0,
      paidCount: paid?.count ?? 0,
      // Paid amount split, so tips are never confused with fares (driver earnings).
      paidFares: (paid?.amount ?? 0) - (paid?.tips ?? 0),
      paidTips: paid?.tips ?? 0,
      pendingAmount: byStatus("PENDING")?.amount ?? 0,
      pendingCount: byStatus("PENDING")?.count ?? 0,
    },
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  };
}

function emptySummary() {
  return { currency: CURRENCY, paidAmount: 0, paidCount: 0, paidFares: 0, paidTips: 0, pendingAmount: 0, pendingCount: 0 };
}

/** GET /api/payments/:paymentId: its passenger, its driver, or ADMIN. Anyone else 404. */
export async function getPayment(viewer: Viewer, paymentId: string) {
  const payment = await Payment.findById(paymentId);
  if (!payment) throw new AppError(404, NOT_FOUND);

  if (viewer.role === "PASSENGER" && String(payment.passengerId) !== viewer.userId) throw new AppError(404, NOT_FOUND);
  if (viewer.role === "DRIVER") {
    const profile = await DriverProfile.findOne({ userId: viewer.userId });
    if (!profile || !payment.driverId.equals(profile._id)) throw new AppError(404, NOT_FOUND);
  }
  return toPaymentView(payment, viewer);
}
