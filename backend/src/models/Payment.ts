import { Schema, Types, model, type HydratedDocument, type InferSchemaType } from "mongoose";
import { cleanJSON } from "./shared.js";

export const PAYMENT_METHODS = ["CASH", "UPI", "CARD"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["PENDING", "COMPLETED", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Who processed the money: the driver (cash) or an online gateway. */
export const PAYMENT_PROVIDERS = ["CASH", "MOCK", "RAZORPAY"] as const;

/** Tip choices the passenger can add for the driver (₹). 0 = no tip. */
export const DRIVER_TIP_OPTIONS = [0, 20, 40, 50, 60] as const;
export type DriverTip = (typeof DRIVER_TIP_OPTIONS)[number];

export interface PaymentAmounts {
  baseFare: number;
  tipAmount: DriverTip;
  taxAmount: number;
  additionalCharges: number;
  discountAmount: number;
  /** What is charged: base + tip + taxes + charges - discount. */
  amount: number;
}

/**
 * The single place a payment total is computed:
 *   Final Amount = Base Fare + Tip + Taxes + Additional Charges - Discounts
 * Fares are tax-inclusive and there are no extra charges or discounts yet, so
 * those are 0 today; they have their own fields so receipts can show them.
 */
export function computePaymentAmounts(baseFare: number, tip: DriverTip = 0): PaymentAmounts {
  const taxAmount = 0;
  const additionalCharges = 0;
  const discountAmount = 0;
  const amount = Math.max(0, baseFare + tip + taxAmount + additionalCharges - discountAmount);
  return { baseFare, tipAmount: tip, taxAmount, additionalCharges, discountAmount, amount };
}

/** A payment that blocks another attempt for the same ride. */
export const OPEN_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "COMPLETED"];

// One document per payment *attempt*. A FAILED attempt stays as history and
// the passenger can try again; at most one PENDING/COMPLETED per ride (index below).
const paymentSchema = new Schema(
  {
    rideId: { type: Types.ObjectId, ref: "Ride", required: true },
    passengerId: { type: Types.ObjectId, ref: "User", required: true },
    // DriverProfile id of the driver who did the ride (and receives the money).
    driverId: { type: Types.ObjectId, ref: "DriverProfile", required: true },

    // All server-computed (computePaymentAmounts); only the tip choice comes from the client.
    // `amount` is the final total actually charged and must equal the parts below.
    amount: { type: Number, required: true, min: 0 },
    // Optional only for payments created before the breakdown existed (then amount = fare).
    baseFare: { type: Number, min: 0 },
    // Goes entirely to the driver; kept separate so it's never mixed with the fare.
    tipAmount: { type: Number, enum: DRIVER_TIP_OPTIONS, default: 0 },
    taxAmount: { type: Number, min: 0, default: 0 },
    additionalCharges: { type: Number, min: 0, default: 0 },
    discountAmount: { type: Number, min: 0, default: 0 },
    currency: { type: String, required: true, default: "INR" },
    method: { type: String, enum: PAYMENT_METHODS, required: true },
    status: { type: String, enum: PAYMENT_STATUSES, required: true, default: "PENDING" },

    provider: { type: String, enum: PAYMENT_PROVIDERS, required: true },
    providerPaymentId: { type: String },
    // Razorpay order the passenger pays in Checkout (one per attempt, fixed amount).
    providerOrderId: { type: String },
    failureReason: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true, toJSON: cleanJSON },
);

/*
 * A ride can't be paid twice: MongoDB rejects a second PENDING/COMPLETED
 * payment for the same ride, even if two requests race past the service check.
 */
// The stored total must always match its parts (checked on every create/save).
type AmountFields = Partial<Omit<PaymentAmounts, "amount">> & { amount: number; invalidate(path: string, message: string): void };
paymentSchema.pre("validate", function (this: AmountFields) {
  if (this.baseFare === undefined || this.baseFare === null) return;
  const expected =
    this.baseFare + (this.tipAmount ?? 0) + (this.taxAmount ?? 0) + (this.additionalCharges ?? 0) - (this.discountAmount ?? 0);
  if (Math.abs(this.amount - Math.max(0, expected)) > 0.001) {
    this.invalidate("amount", "Payment amount must equal base fare + tip + taxes + charges - discounts.");
  }
});

paymentSchema.index(
  { rideId: 1 },
  { unique: true, partialFilterExpression: { status: { $in: OPEN_PAYMENT_STATUSES } }, name: "one_open_payment_per_ride" },
);
// Webhooks find the payment by Razorpay order id.
paymentSchema.index({ providerOrderId: 1 }, { sparse: true, name: "by_provider_order" });
// Payment history, newest first, for each side.
paymentSchema.index({ passengerId: 1, createdAt: -1 });
paymentSchema.index({ driverId: 1, createdAt: -1 });

export type PaymentDocument = HydratedDocument<InferSchemaType<typeof paymentSchema>>;

export const Payment = model("Payment", paymentSchema);
