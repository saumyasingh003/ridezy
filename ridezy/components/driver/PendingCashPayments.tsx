"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Banknote, CheckCircle2, Loader2 } from "lucide-react";
import { api, type PaymentHistory, type PaymentView } from "@/lib/rideApi";

// Cash a passenger chose to pay is PENDING until the driver confirms it.
const POLL_MS = 5_000;

/**
 * Driver: cash payments waiting for confirmation (GET /api/payments/history?status=PENDING)
 * with a "Cash received" button (POST /api/payments/:id/confirm-cash). Renders
 * nothing when there is nothing to confirm.
 */
export default function PendingCashPayments({ onConfirmed }: { onConfirmed?: (payment: PaymentView) => void }) {
  const [pending, setPending] = useState<PaymentView[]>([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [justConfirmed, setJustConfirmed] = useState<PaymentView | null>(null);

  useEffect(() => {
    const load = () =>
      api<PaymentHistory>("/payments/history?status=PENDING&limit=20").then(({ ok, data }) => {
        if (ok && data) setPending(data.payments.filter((p) => p.method === "CASH"));
      });
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const confirm = async (payment: PaymentView) => {
    setConfirming(payment.id);
    setError("");
    const { ok, message, data } = await api<PaymentView>(`/payments/${payment.id}/confirm-cash`, { method: "POST" });
    setConfirming(null);
    setPending((prev) => prev.filter((p) => p.id !== payment.id));
    if (ok && data) {
      setJustConfirmed(data);
      onConfirmed?.(data);
      setTimeout(() => setJustConfirmed(null), 4000);
    } else {
      setError(message);
    }
  };

  if (pending.length === 0 && !justConfirmed && !error) return null;

  return (
    <section aria-label="Cash to collect" className="space-y-3">
      {justConfirmed && (
        <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-medium text-emerald-800">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          ₹{justConfirmed.amount} cash from {justConfirmed.passenger?.name || "the passenger"} confirmed
          {(justConfirmed.tipAmount ?? 0) > 0 ? ` (incl. ₹${justConfirmed.tipAmount} tip)` : ""}.
        </p>
      )}
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      {pending.map((payment) => (
        <div
          key={payment.id}
          className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
            <Banknote className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-black">
              Collect ₹{payment.amount} cash from {payment.passenger?.name || "the passenger"}
              {(payment.tipAmount ?? 0) > 0 && (
                <span className="ml-1.5 text-xs font-medium text-stone-500">incl. ₹{payment.tipAmount} tip</span>
              )}
            </p>
            <p className="truncate text-xs text-stone-500">
              {payment.ride ? `${payment.ride.pickup} → ${payment.ride.destination}` : "Completed ride"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => confirm(payment)}
            disabled={confirming !== null}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-5 py-2.5 text-xs font-bold text-white transition-colors hover:bg-neutral-800 disabled:opacity-60"
          >
            {confirming === payment.id ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Cash received
          </button>
        </div>
      ))}
    </section>
  );
}
