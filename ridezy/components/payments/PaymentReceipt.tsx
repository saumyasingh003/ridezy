"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Banknote, CreditCard, Loader2, Mail, Receipt, Smartphone, X, type LucideIcon } from "lucide-react";
import RateRide, { Stars } from "@/components/ratings/RateRide";
import { api, PAYMENT_METHOD_LABELS, type PaymentMethod, type PaymentStatus, type PaymentView } from "@/lib/rideApi";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { UPI: Smartphone, CARD: CreditCard, CASH: Banknote };

const STATUS: Record<PaymentStatus, { label: string; className: string }> = {
  COMPLETED: { label: "Paid", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  PENDING: { label: "Awaiting driver", className: "bg-amber-50 text-amber-800 border-amber-200" },
  FAILED: { label: "Failed", className: "bg-rose-50 text-rose-700 border-rose-200" },
  REFUNDED: { label: "Refunded", className: "bg-stone-100 text-stone-700 border-stone-200" },
};

function formatDateTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Receipt for one payment (GET /api/payments/:paymentId). The backend decides
 * who may see it (its passenger, its driver, or an admin).
 */
export default function PaymentReceipt({ paymentId, onClose }: { paymentId: string; onClose: () => void }) {
  const [result, setResult] = useState<{ id: string; payment: PaymentView | null; error: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<PaymentView>(`/payments/${paymentId}`).then(({ ok, data, message }) => {
      if (!cancelled) setResult({ id: paymentId, payment: ok ? data : null, error: ok ? "" : message });
    });
    return () => {
      cancelled = true;
    };
  }, [paymentId]);

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const loading = result?.id !== paymentId;
  const payment = !loading ? result?.payment ?? null : null;
  const error = !loading ? result?.error ?? "" : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Payment receipt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto rounded-2xl border border-[#EDEDE8] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[#F0EFEA] px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111111] text-white">
              <Receipt className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Ridezy</p>
              <h2 className="font-caslon text-xl font-bold leading-tight text-[#111111]">Payment Receipt</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close receipt"
            className="flex h-8 w-8 items-center justify-center rounded-full text-stone-500 transition-colors hover:bg-stone-100 hover:text-black"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading && (
          <div className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-stone-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading receipt…
          </div>
        )}

        {!loading && !payment && (
          <p className="flex items-center justify-center gap-2 px-6 py-14 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4" /> {error || "Receipt not available."}
          </p>
        )}

        {payment && (
          <div className="px-6 py-5">
            {/* Amount */}
            <div className="text-center">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-stone-400">Amount</p>
              <p
                className={`mt-1 font-caslon text-5xl font-bold leading-none tracking-tight ${
                  payment.status === "FAILED" ? "text-stone-400 line-through" : "text-[#111111]"
                }`}
              >
                ₹{payment.amount}
              </p>
              <span
                className={`mt-3 inline-block rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${
                  STATUS[payment.status].className
                }`}
              >
                {STATUS[payment.status].label}
              </span>
            </div>

            {/* Trip */}
            {payment.ride && (
              <div className="relative mt-6 space-y-3 rounded-xl bg-[#FAFAF8] p-4 pl-9">
                <span aria-hidden="true" className="absolute left-[19px] top-[26px] bottom-[26px] w-px bg-stone-300" />
                <div className="relative">
                  <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-[3px] ring-emerald-100" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pickup</p>
                  <p className="text-sm font-medium text-black">{payment.ride.pickup}</p>
                </div>
                <div className="relative">
                  <span className="absolute -left-[22px] top-1 h-2.5 w-2.5 rounded-full bg-black ring-[3px] ring-neutral-200" />
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Drop</p>
                  <p className="text-sm font-medium text-black">{payment.ride.destination}</p>
                </div>
              </div>
            )}

            {/* Fare breakdown (from the server; total = what was charged). Zero lines are omitted. */}
            {payment.breakdown && (
              <dl className="mt-5 space-y-2 rounded-xl border border-[#EDEDE8] px-4 py-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Base ride fare</dt>
                  <dd className="font-semibold text-black">₹{payment.breakdown.baseFare}</dd>
                </div>
                {payment.breakdown.tip > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Driver tip</dt>
                    <dd className="font-semibold text-black">
                      ₹{payment.breakdown.tip}
                      {!payment.tipPaid && (
                        <span className="ml-1 text-xs font-medium text-stone-400">
                          ({payment.status === "PENDING" ? "pending" : "not charged"})
                        </span>
                      )}
                    </dd>
                  </div>
                )}
                {payment.breakdown.taxes > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Taxes</dt>
                    <dd className="font-semibold text-black">₹{payment.breakdown.taxes}</dd>
                  </div>
                )}
                {payment.breakdown.additionalCharges > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Additional charges</dt>
                    <dd className="font-semibold text-black">₹{payment.breakdown.additionalCharges}</dd>
                  </div>
                )}
                {payment.breakdown.discount > 0 && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-stone-500">Discount</dt>
                    <dd className="font-semibold text-emerald-700">−₹{payment.breakdown.discount}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4 border-t border-[#EDEDE8] pt-2">
                  <dt className="font-bold text-black">Total</dt>
                  <dd className="font-bold text-black">₹{payment.breakdown.total}</dd>
                </div>
              </dl>
            )}

            {/* Details */}
            <dl className="mt-5 space-y-2.5 text-sm">
              {payment.passenger && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Passenger</dt>
                  <dd className="font-semibold text-black">{payment.passenger.name}</dd>
                </div>
              )}
              {payment.driver && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Driver</dt>
                  <dd className="font-semibold text-black">{payment.driver.name}</dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">Method</dt>
                <dd className="flex items-center gap-1.5 font-semibold text-black">
                  {(() => {
                    const Icon = METHOD_ICON[payment.method];
                    return <Icon className="h-3.5 w-3.5" />;
                  })()}
                  {PAYMENT_METHOD_LABELS[payment.method]}
                </dd>
              </div>
              {payment.ride && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Trip</dt>
                  <dd className="font-semibold text-black">
                    {payment.ride.vehicleType} · {payment.ride.distanceKm.toFixed(1)} km
                  </dd>
                </div>
              )}
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{payment.status === "COMPLETED" ? "Paid on" : "Created"}</dt>
                <dd className="font-semibold text-black">{formatDateTime(payment.paidAt ?? payment.createdAt)}</dd>
              </div>
              {payment.failureReason && (
                <div className="flex justify-between gap-4">
                  <dt className="text-stone-500">Reason</dt>
                  <dd className="text-right font-semibold text-rose-700">{payment.failureReason}</dd>
                </div>
              )}
            </dl>

            {/* Rating: asked for until the passenger rates the driver */}
            {payment.canRate && payment.driver && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                <RateRide
                  compact
                  rideId={payment.rideId}
                  subject={`your ride with ${payment.driver.name}`}
                  onRated={(rating) =>
                    setResult((r) =>
                      r?.payment
                        ? {
                            ...r,
                            payment: {
                              ...r.payment,
                              canRate: false,
                              myRating: { score: rating.score, comment: rating.comment ?? null },
                            },
                          }
                        : r,
                    )
                  }
                />
              </div>
            )}
            {payment.myRating && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-xl bg-[#FAFAF8] px-4 py-3 text-sm">
                <span className="text-stone-500">Your rating</span>
                <span className="flex min-w-0 items-center gap-2">
                  <Stars score={payment.myRating.score} />
                  {payment.myRating.comment && (
                    <span className="truncate text-xs text-stone-500">“{payment.myRating.comment}”</span>
                  )}
                </span>
              </div>
            )}

            <div className="mt-5 space-y-1 border-t border-dashed border-stone-300 pt-4 font-mono text-[11px] text-stone-500">
              <p>Receipt #{payment.id.slice(-8).toUpperCase()}</p>
              {payment.providerPaymentId && <p className="truncate">Ref: {payment.providerPaymentId}</p>}
              {payment.provider === "MOCK" && <p>Test mode: no real money was charged.</p>}
              {payment.status === "COMPLETED" && payment.driver && (
                <p className="flex items-center gap-1.5 pt-1 font-sans text-[11px] text-stone-500">
                  <Mail className="h-3 w-3" /> A copy of this receipt was emailed to you.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
