import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import Razorpay from "razorpay";
import { env } from "../config/env.js";

/*
 * The one place that talks to a payment provider. payment.service.ts only sees
 * these two shapes:
 *
 * - "instant" (MOCK): charge() answers right away. Used by tests and when no
 *   Razorpay keys are configured. No real money moves.
 * - "checkout" (RAZORPAY): the server creates an order, the browser opens
 *   Razorpay Checkout, and the payment is confirmed by
 *     (1) the Checkout callback, verified with an HMAC signature, and/or
 *     (2) Razorpay's webhook, verified with the webhook secret.
 *   Either one marks the payment paid; both are idempotent.
 */

export interface ChargeRequest {
  amount: number; // whole rupees
  currency: string;
  method: "UPI" | "CARD";
  /** Our payment id, sent to the provider so both sides can be reconciled. */
  reference: string;
}

export type ChargeResult =
  | { status: "SUCCEEDED"; providerPaymentId: string }
  | { status: "FAILED"; providerPaymentId: string; failureReason: string };

export interface InstantGateway {
  kind: "instant";
  name: "MOCK";
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

/** A payment as Razorpay reports it (amount in paise). */
export interface ProviderPayment {
  id: string;
  orderId: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  amountPaise: number;
  currency: string;
  method?: string;
  errorDescription?: string;
}

export interface CheckoutGateway {
  kind: "checkout";
  name: "RAZORPAY";
  /** Public key id for Razorpay Checkout in the browser. */
  keyId: string;
  createOrder(input: {
    amountPaise: number;
    currency: string;
    receipt: string;
    notes: Record<string, string>;
  }): Promise<{ orderId: string }>;
  /** Checkout callback: HMAC_SHA256(order_id + "|" + payment_id, key_secret). */
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string): boolean;
  /** Webhook: HMAC_SHA256(raw request body, webhook_secret). */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean;
  /** Ask Razorpay for the payment (never trust the browser's word that it's paid). */
  fetchPayment(paymentId: string): Promise<ProviderPayment>;
  /** Capture an authorized payment (accounts without auto-capture). */
  capturePayment(paymentId: string, amountPaise: number, currency: string): Promise<ProviderPayment>;
}

export type PaymentGateway = InstantGateway | CheckoutGateway;

/* ---------------------------------- Mock ----------------------------------- */

/** Simulated provider: no real money moves; every charge succeeds. */
export const mockGateway: InstantGateway = {
  kind: "instant",
  name: "MOCK",
  async charge() {
    return { status: "SUCCEEDED", providerPaymentId: `mock_pay_${randomUUID()}` };
  },
};

/* --------------------------------- Razorpay --------------------------------- */

/** The few Razorpay REST calls we need; the SDK by default, a fake in tests. */
export interface RazorpayApi {
  createOrder(body: { amount: number; currency: string; receipt: string; notes: Record<string, string> }): Promise<{ id: string }>;
  fetchPayment(paymentId: string): Promise<Record<string, unknown>>;
  capturePayment(paymentId: string, amount: number, currency: string): Promise<Record<string, unknown>>;
}

function sdkApi(keyId: string, keySecret: string): RazorpayApi {
  const client = new Razorpay({ key_id: keyId, key_secret: keySecret });
  return {
    createOrder: async (body) => (await client.orders.create(body)) as unknown as { id: string },
    fetchPayment: async (id) => (await client.payments.fetch(id)) as unknown as Record<string, unknown>,
    capturePayment: async (id, amount, currency) =>
      (await client.payments.capture(id, amount, currency)) as unknown as Record<string, unknown>,
  };
}

function hmacMatches(secret: string, payload: string | Buffer, signature: string): boolean {
  if (!secret || !signature) return false;
  const expected = createHmac("sha256", secret).update(payload).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b); // constant time: no timing leaks
}

function toProviderPayment(raw: Record<string, unknown>): ProviderPayment {
  return {
    id: String(raw.id),
    orderId: String(raw.order_id ?? ""),
    status: raw.status as ProviderPayment["status"],
    amountPaise: Number(raw.amount),
    currency: String(raw.currency),
    method: raw.method ? String(raw.method) : undefined,
    errorDescription: raw.error_description ? String(raw.error_description) : undefined,
  };
}

export function createRazorpayGateway(config: {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
  api?: RazorpayApi;
}): CheckoutGateway {
  const api = config.api ?? sdkApi(config.keyId, config.keySecret);
  return {
    kind: "checkout",
    name: "RAZORPAY",
    keyId: config.keyId,
    async createOrder({ amountPaise, currency, receipt, notes }) {
      const order = await api.createOrder({ amount: amountPaise, currency, receipt, notes });
      return { orderId: order.id };
    },
    verifyCheckoutSignature: (orderId, paymentId, signature) =>
      hmacMatches(config.keySecret, `${orderId}|${paymentId}`, signature),
    verifyWebhookSignature: (rawBody, signature) => hmacMatches(config.webhookSecret, rawBody, signature),
    fetchPayment: async (paymentId) => toProviderPayment(await api.fetchPayment(paymentId)),
    capturePayment: async (paymentId, amountPaise, currency) =>
      toProviderPayment(await api.capturePayment(paymentId, amountPaise, currency)),
  };
}

/* --------------------------------- Selection -------------------------------- */

let current: PaymentGateway =
  env.payments.provider === "razorpay" ? createRazorpayGateway(env.payments.razorpay) : mockGateway;

export function getPaymentGateway(): PaymentGateway {
  return current;
}

/** Tests swap in another gateway (a failing mock, or Razorpay with a fake API). */
export function setPaymentGateway(gateway: PaymentGateway): void {
  current = gateway;
}
