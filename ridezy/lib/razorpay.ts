"use client";

// Razorpay Checkout in the browser. The backend creates the order (with the
// exact amount) and later verifies the result; this only opens the payment window.

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

/** Returned by POST /api/rides/:rideId/payment for UPI/CARD when Razorpay is enabled. */
export interface RazorpayCheckout {
  provider: "RAZORPAY";
  keyId: string;
  orderId: string;
  /** In paise. */
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
}

export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  on(event: "payment.failed", handler: (response: { error?: { description?: string } }) => void): void;
}
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

let loading: Promise<RazorpayConstructor> | null = null;

function loadCheckout(): Promise<RazorpayConstructor> {
  const existing = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
  if (existing) return Promise.resolve(existing);
  loading ??= new Promise<RazorpayConstructor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => {
      const ctor = (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
      if (ctor) resolve(ctor);
      else reject(new Error("Razorpay failed to load."));
    };
    script.onerror = () => {
      loading = null;
      reject(new Error("Couldn't load Razorpay. Check your internet connection."));
    };
    document.body.appendChild(script);
  });
  return loading;
}

/**
 * Opens Checkout. Resolves with Razorpay's success payload (to send to the
 * backend for verification), or null if the passenger closed the window.
 * Failed attempts are reported through `onAttemptFailed`; Checkout stays open
 * so they can retry with another method.
 */
export async function openRazorpayCheckout(
  checkout: RazorpayCheckout,
  onAttemptFailed?: (reason: string) => void,
): Promise<RazorpaySuccess | null> {
  const Razorpay = await loadCheckout();
  return new Promise((resolve) => {
    const instance = new Razorpay({
      key: checkout.keyId,
      order_id: checkout.orderId,
      amount: checkout.amount,
      currency: checkout.currency,
      name: checkout.name,
      description: checkout.description,
      prefill: checkout.prefill,
      theme: { color: "#111111" },
      handler: (response: RazorpaySuccess) => resolve(response),
      modal: { ondismiss: () => resolve(null), confirm_close: true },
    });
    instance.on("payment.failed", (response) => onAttemptFailed?.(response.error?.description ?? "Payment failed."));
    instance.open();
  });
}
