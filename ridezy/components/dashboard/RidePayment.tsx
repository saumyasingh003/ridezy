"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Banknote,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import PaymentReceipt from "@/components/payments/PaymentReceipt";
import { openRazorpayCheckout, type RazorpayCheckout } from "@/lib/razorpay";
import {
  api,
  PAYMENT_METHOD_LABELS,
  TIP_OPTIONS,
  type PaymentMethod,
  type PaymentView,
  type RideView,
  type TipAmount,
} from "@/lib/rideApi";

const METHODS: { id: PaymentMethod; detail: string; icon: LucideIcon }[] = [
  { id: "UPI", detail: "Pay instantly with any UPI app", icon: Smartphone },
  { id: "CARD", detail: "Debit or credit card", icon: CreditCard },
  { id: "CASH", detail: "Pay the driver directly", icon: Banknote },
];

/**
 * Payment for a completed ride (POST /api/rides/:rideId/payment).
 * UPI/CARD go through the (simulated) gateway and complete instantly; CASH
 * waits for the driver to confirm, which the parent picks up by polling.
 */
export default function RidePayment({
  ride,
  onPaymentChange,
}: {
  ride: RideView;
  onPaymentChange: (payment: NonNullable<RideView["payment"]>) => void;
}) {
  const [method, setMethod] = useState<PaymentMethod>("UPI");
  const [paying, setPaying] = useState(false);
  const [error, setError] = useState("");
  // Completing a ride already opens a PENDING CASH payment on the backend, so
  // "pending cash" alone doesn't mean the passenger picked cash. The waiting
  // screen is shown only after they choose Cash here; until then all three
  // methods are offered (picking UPI/Card closes the pending cash attempt).
  const [cashChosen, setCashChosen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  // Starts with the tip offered during the ride; the passenger can still change it.
  const [tip, setTip] = useState<TipAmount>((ride.payment?.tipAmount ?? ride.tipAmount ?? 0) as TipAmount);

  // Before paying: preview of the backend's total (fare + tip; no taxes, charges
  // or discounts today). After paying, everything shown comes from the server.
  const baseFare = ride.finalFare ?? ride.estimatedFare;
  const amount = baseFare + tip;
  const payment = ride.payment ?? null;
  const driverName = ride.driver?.name ?? "your driver";
  const driverFirstName = driverName.split(" ")[0];

  const applyPayment = (data: PaymentView) =>
    onPaymentChange({
      id: data.id,
      status: data.status,
      method: data.method,
      amount: data.amount,
      tipAmount: data.tipAmount,
      tipPaid: data.tipPaid,
      breakdown: data.breakdown,
    });

  const pay = async (chosen: PaymentMethod) => {
    setPaying(true);
    setError("");
    const { ok, message, data } = await api<PaymentView & { checkout?: RazorpayCheckout | null }>(
      `/rides/${ride.id}/payment`,
      { method: "POST", body: JSON.stringify({ method: chosen, tip }) },
    );
    if (!ok || !data) {
      setPaying(false);
      setError(message);
      return;
    }

    // UPI / Card with Razorpay: pay in Checkout, then the server verifies it.
    if (data.checkout) {
      try {
        const result = await openRazorpayCheckout(data.checkout, (reason) => setError(`${reason} Try again or use another method.`));
        if (!result) {
          setError("Payment window closed. Nothing was charged; you can try again.");
          return;
        }
        setError("");
        const verified = await api<PaymentView>(`/payments/${data.id}/razorpay/verify`, {
          method: "POST",
          body: JSON.stringify(result),
        });
        if (verified.ok && verified.data) applyPayment(verified.data);
        else setError(verified.message || "We couldn't confirm the payment. If money was deducted, it will update shortly.");
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setPaying(false);
      }
      return;
    }

    setPaying(false);
    applyPayment(data);
    setCashChosen(chosen === "CASH");
  };

  /* ---------- Paid ---------- */
  if (payment?.status === "COMPLETED") {
    return (
      <div role="status" className="w-full rounded-md bg-[#111111] p-5 text-left text-white">
        <div className="flex items-center gap-3">
          <CheckCircle2 size={22} className="shrink-0 text-emerald-400" />
          <div>
            <p className="text-sm font-semibold">Payment successful</p>
            <p className="text-xs text-white/70">
              ₹{payment.amount} paid via {PAYMENT_METHOD_LABELS[payment.method]}
              {payment.tipPaid && payment.tipAmount ? `, including a ₹${payment.tipAmount} tip for ${driverFirstName}` : ""}.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setShowReceipt(true)}
            className="rounded-md border border-white/20 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-white/10"
          >
            View receipt
          </button>
          <Link
            href="/dashboard/payments"
            className="flex items-center justify-center gap-1.5 rounded-md bg-white py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F4F4F4]"
          >
            Payments
            <ArrowRight size={14} />
          </Link>
        </div>
        {showReceipt && <PaymentReceipt paymentId={payment.id} onClose={() => setShowReceipt(false)} />}
      </div>
    );
  }

  /* ---------- Cash pending: waiting for the driver ---------- */
  if (payment?.status === "PENDING" && payment.method === "CASH" && cashChosen) {
    return (
      <div className="w-full rounded-md border border-[#E8E8E8] bg-white p-5 text-left">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#FFF8E6] text-[#8A5A00]">
            <Banknote size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[#111111]">
              Pay ₹{payment.amount} in cash to {driverName}
            </p>
            {payment.tipAmount ? (
              <p className="mt-0.5 text-xs text-[#7A7A7A]">
                ₹{payment.breakdown?.baseFare ?? payment.amount - payment.tipAmount} fare + ₹{payment.tipAmount} tip
              </p>
            ) : null}
            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-[#7A7A7A]">
              <Loader2 size={12} className="animate-spin" />
              Waiting for the driver to confirm they received it…
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setCashChosen(false);
            setMethod("UPI");
          }}
          className="mt-4 w-full rounded-md border border-[#E8E8E8] py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F4F4F4]"
        >
          Pay online instead
        </button>
      </div>
    );
  }

  /* ---------- Choose a method ---------- */
  return (
    <div className="w-full rounded-md border border-[#E8E8E8] bg-white p-5 text-left">
      {/* Fare breakdown: Final Amount = Base Fare + Tip (+ taxes/charges − discounts, none today) */}
      <div className="border-b border-dashed border-[#D4D4D4] pb-4">
        <dl className="space-y-1.5 text-sm">
          <div className="flex justify-between">
            <dt className="text-[#7A7A7A]">Base ride fare</dt>
            <dd className="font-semibold text-[#111111]">₹{baseFare}</dd>
          </div>
          {tip > 0 && (
            <div className="flex justify-between">
              <dt className="text-[#7A7A7A]">Driver tip</dt>
              <dd className="font-semibold text-[#111111]">₹{tip}</dd>
            </div>
          )}
        </dl>
        <div className="mt-3 flex items-end justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">Total</p>
          <p className="font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111]">₹{amount}</p>
        </div>
      </div>

      {/* Optional tip: goes entirely to the driver */}
      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">Tip {driverFirstName}</p>
      <div className="mt-2 grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Driver tip">
        {([0, ...TIP_OPTIONS] as TipAmount[]).map((value) => {
          const active = tip === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTip(value)}
              className={`rounded-md border py-2 text-xs font-bold transition-colors ${
                active
                  ? "border-[#111111] bg-[#111111] text-white"
                  : "border-[#E8E8E8] bg-white text-[#111111] hover:border-[#111111]"
              }`}
            >
              {value === 0 ? "No tip" : `₹${value}`}
            </button>
          );
        })}
      </div>

      <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">Pay with</p>
      <div className="mt-3 space-y-2" role="radiogroup" aria-label="Payment method">
        {METHODS.map((m) => {
          const Icon = m.icon;
          const active = m.id === method;
          return (
            <button
              key={m.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMethod(m.id)}
              className={`group flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-all duration-200 ${
                active
                  ? "border-[#111111] bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)]"
                  : "border-transparent bg-[#F4F4F4] hover:bg-[#EDEDED]"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition-colors ${
                  active ? "bg-[#111111] text-white" : "bg-white text-[#111111]"
                }`}
              >
                <Icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-[#111111]">{PAYMENT_METHOD_LABELS[m.id]}</span>
                <span className="block truncate text-xs text-[#7A7A7A]">{m.detail}</span>
              </span>
              {active && <Check size={16} className="text-[#111111]" />}
            </button>
          );
        })}
      </div>

      {error && (
        <p role="alert" className="mt-3 flex items-start gap-1.5 text-xs font-medium text-[#B3261E]">
          <AlertCircle size={14} className="mt-px shrink-0" />
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => pay(method)}
        disabled={paying}
        className="group mt-4 flex w-full items-center justify-center gap-2 rounded-md bg-[#111111] py-3.5 text-[15px] font-semibold text-white shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)] transition-all duration-300 hover:bg-black active:scale-[0.99] disabled:opacity-60"
      >
        {paying ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            {method === "CASH" ? "Confirming…" : "Complete the payment in Razorpay…"}
          </>
        ) : (
          <>
            {method === "CASH" ? `Pay ₹${amount} in cash` : `Pay ₹${amount}`}
            <ArrowRight size={16} strokeWidth={2.25} className="transition-transform duration-300 group-hover:translate-x-0.5" />
          </>
        )}
      </button>
      <p className="mt-2 text-center text-[11px] text-[#A3A3A3]">Secure payments by Razorpay. Test mode: no real money is charged.</p>
    </div>
  );
}
