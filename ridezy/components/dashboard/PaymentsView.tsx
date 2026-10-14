"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Banknote,
  CreditCard,
  Loader2,
  ShieldCheck,
  Smartphone,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { rideOptionFor } from "./data";
import PaymentReceipt from "@/components/payments/PaymentReceipt";
import {
  api,
  PAYMENT_METHOD_LABELS,
  type PaymentHistory,
  type PaymentMethod,
  type PaymentStatus,
} from "@/lib/rideApi";

const PAGE_SIZE = 20;
const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { UPI: Smartphone, CARD: CreditCard, CASH: Banknote };

// Filter tab → server-side ?status= (GET /api/payments/history)
const filters = [
  { label: "All", status: null },
  { label: "Paid", status: "COMPLETED" },
  { label: "Pending", status: "PENDING" },
  { label: "Failed", status: "FAILED" },
] as const satisfies readonly { label: string; status: PaymentStatus | null }[];
type FilterLabel = (typeof filters)[number]["label"];

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  COMPLETED: { label: "Paid", className: "bg-[#F4F4F4] text-[#111111]" },
  PENDING: { label: "Awaiting driver", className: "bg-[#FFF8E6] text-[#8A5A00]" },
  FAILED: { label: "Failed", className: "bg-[#FDF3F3] text-[#D92D20]" },
  REFUNDED: { label: "Refunded", className: "bg-emerald-50 text-emerald-700" },
};

function formatWhen(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { month: "short", day: "numeric" })}, ${time}`;
}

function historyPath(status: PaymentStatus | null, page: number) {
  return `/payments/history?page=${page}&limit=${PAGE_SIZE}${status ? `&status=${status}` : ""}`;
}

export default function PaymentsView() {
  const [filter, setFilter] = useState<FilterLabel>("All");
  const [list, setList] = useState<{ filter: FilterLabel; data: PaymentHistory } | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [completedRideSpent, setCompletedRideSpent] = useState<{ amount: number; count: number } | null>(null);

  const status = filters.find((f) => f.label === filter)!.status;
  const loading = list?.filter !== filter;

  // Fallback check on completed ride history if payment summary is 0
  useEffect(() => {
    api<{ rides: Array<{ finalFare?: number; estimatedFare: number }>; pagination: { total: number } }>(
      "/rides/history?status=RIDE_COMPLETED&limit=100"
    ).then(({ ok, data }) => {
      if (ok && data && data.rides.length > 0) {
        const spent = data.rides.reduce((sum, r) => sum + (r.finalFare ?? r.estimatedFare), 0);
        setCompletedRideSpent({ amount: spent, count: data.pagination.total });
      }
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    api<PaymentHistory>(historyPath(status, 1)).then(({ ok, data, message }) => {
      if (cancelled) return;
      if (ok && data) {
        setList({ filter, data });
        setError("");
      } else {
        setError(message);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [filter, status]);

  const loadMore = async () => {
    if (!list) return;
    setLoadingMore(true);
    const { ok, data, message } = await api<PaymentHistory>(historyPath(status, list.data.pagination.page + 1));
    setLoadingMore(false);
    if (ok && data) {
      setList({ filter, data: { ...data, payments: [...list.data.payments, ...data.payments] } });
    } else {
      setError(message);
    }
  };

  const payments = list && !loading ? list.data.payments : [];
  const summary = list?.data.summary;
  const pagination = list?.data.pagination;
  const hasMore = !loading && pagination ? pagination.page < pagination.pages : false;

  // Derive robust totals: server summary > payment list items > completed rides total
  const completedPayments = payments.filter((p) => p.status === "COMPLETED");
  const fallbackPaidAmount = completedPayments.reduce((s, p) => s + p.amount, 0);
  const fallbackPaidCount = completedPayments.length;

  const totalPaidAmount =
    summary && summary.paidAmount > 0
      ? summary.paidAmount
      : fallbackPaidAmount > 0
      ? fallbackPaidAmount
      : completedRideSpent?.amount ?? 0;

  const totalPaidCount =
    summary && summary.paidCount > 0
      ? summary.paidCount
      : fallbackPaidCount > 0
      ? fallbackPaidCount
      : completedRideSpent?.count ?? 0;

  const pendingPayments = payments.filter((p) => p.status === "PENDING");
  const fallbackPendingAmount = pendingPayments.reduce((s, p) => s + p.amount, 0);
  const pendingAmount = summary && summary.pendingAmount > 0 ? summary.pendingAmount : fallbackPendingAmount;

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-12 space-y-6">
        {/* BANNER — Exact driver banner style */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[195px] sm:h-[220px] lg:h-[240px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/customer-banner2.webp"
              alt="Customer payments banner"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "center 15%" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />
          </div>

          <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 flex flex-col justify-center">
            <div className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                Billing &amp; Wallet &bull; Ridezy Passenger
              </span>
              <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight mt-1">
                Payments
              </h1>
              <p className="text-xs sm:text-sm text-white/90 mt-1 sm:mt-1.5 font-medium leading-relaxed drop-shadow-xs">
                Every charge and refund on your Ridezy account, plus your payment receipts.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          {/* Summary */}
          <section className="relative overflow-hidden rounded-md bg-[#111111] p-6 text-white sm:p-7">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full border border-white/10" />
            <div className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full border border-white/10" />

            <div className="relative">
              <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">
                <Wallet size={13} />
                Total paid
              </p>
              <p className="mt-3 font-caslon text-5xl font-bold leading-none tracking-tight">
                ₹{totalPaidAmount.toLocaleString("en-IN")}
              </p>
              <p className="mt-2 text-xs text-white/60">
                {list
                  ? `${totalPaidCount} ${totalPaidCount === 1 ? "ride" : "rides"} paid`
                  : "Loading…"}
                {summary && (summary.paidTips ?? 0) > 0
                  ? ` · incl. ₹${summary.paidTips!.toLocaleString("en-IN")} in driver tips`
                  : ""}
              </p>

              {pendingAmount > 0 && (
                <p className="mt-5 inline-flex items-center gap-2 rounded-md bg-white/10 px-3.5 py-2 text-xs">
                  <Banknote size={14} />
                  ₹{pendingAmount.toLocaleString("en-IN")} in cash waiting for the driver to confirm
                </p>
              )}
            </div>
          </section>

          {/* Transactions */}
          <section className="rounded-md border border-[#E8E8E8] bg-white">
            <div className="flex flex-col gap-3 border-b border-[#E8E8E8] px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={eyebrow}>Activity</p>
                <h2 className="mt-1 font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">
                  Transactions
                </h2>
              </div>
              <div className="flex gap-1 rounded-md bg-[#F4F4F4] p-1" role="group" aria-label="Filter payments">
                {filters.map((f) => (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => setFilter(f.label)}
                    aria-pressed={filter === f.label}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                      filter === f.label
                        ? "bg-[#111111] text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]"
                        : "text-[#5A5A5A] hover:bg-white hover:text-[#111111]"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <ul className="divide-y divide-[#F0F0F0]">
              {loading && (
                <li className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[#8A8A8A]">
                  <Loader2 size={15} className="animate-spin" /> Loading payments…
                </li>
              )}

              {payments.map((p) => {
                const Icon = METHOD_ICON[p.method];
                const style = STATUS_STYLE[p.status];
                const vehicle = p.ride ? rideOptionFor(p.ride.vehicleType).name : null;
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setReceiptId(p.id)}
                      aria-label="View receipt"
                      className="group flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-[#FAFAFA]"
                    >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#E0E0E0] bg-white text-[#111111] transition-colors duration-200 group-hover:border-[#111111]">
                      <Icon size={16} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[#111111]">
                        {p.ride ? (
                          <>
                            {p.ride.pickup} <span className="text-[#A3A3A3]">→</span> {p.ride.destination}
                          </>
                        ) : (
                          "Ride payment"
                        )}
                      </p>
                      <p className="text-xs text-[#8A8A8A]">
                        {formatWhen(p.paidAt ?? p.createdAt)} · {PAYMENT_METHOD_LABELS[p.method]}
                        {vehicle ? ` · ${vehicle}` : ""}
                        {p.failureReason ? ` · ${p.failureReason}` : ""}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span
                        className={`text-sm font-bold ${
                          p.status === "FAILED" ? "text-[#A3A3A3] line-through" : "text-[#111111]"
                        }`}
                      >
                        ₹{p.amount}
                      </span>
                      {/* amount already includes the tip; FAILED payments show no tip */}
                      {p.status !== "FAILED" && (p.tipAmount ?? 0) > 0 && (
                        <span className="text-[10px] font-medium text-[#8A8A8A]">
                          incl. ₹{p.tipAmount} tip{p.tipPaid ? "" : " (pending)"}
                        </span>
                      )}
                      <span className={`rounded-md px-2 py-0.5 text-[10px] font-semibold ${style.className}`}>
                        {style.label}
                      </span>
                    </div>
                    </button>
                  </li>
                );
              })}

              {!loading && payments.length === 0 && (
                <li className="px-5 py-12 text-center text-sm text-[#8A8A8A]">
                  {error ? (
                    <span className="inline-flex items-center gap-1.5 text-[#B3261E]">
                      <AlertCircle size={14} /> {error}
                    </span>
                  ) : (
                    "No payments here yet."
                  )}
                </li>
              )}
            </ul>

            {hasMore && (
              <div className="border-t border-[#E8E8E8] p-4 text-center">
                <button
                  type="button"
                  onClick={loadMore}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 rounded-md border border-[#111111] px-5 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#111111] hover:text-white disabled:opacity-50"
                >
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  Load more
                </button>
              </div>
            )}
          </section>
        </div>

        {/* How paying works */}
        <aside className="h-fit rounded-md border border-[#E8E8E8] bg-white p-5 sm:p-6">
          <p className={eyebrow}>Pay with</p>
          <h2 className="mt-1.5 font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">
            Payment Methods
          </h2>
          <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

          <ul className="mt-6 space-y-2">
            {(
              [
                { id: "UPI", detail: "Paid instantly when your trip ends" },
                { id: "CARD", detail: "Debit or credit card, paid instantly" },
                { id: "CASH", detail: "Pay the driver; they confirm receipt" },
              ] as const
            ).map((m) => {
              const Icon = METHOD_ICON[m.id];
              return (
                <li key={m.id} className="flex items-center gap-3 rounded-md bg-[#F4F4F4] px-3 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-white text-[#111111]">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-[#111111]">{PAYMENT_METHOD_LABELS[m.id]}</span>
                    <span className="block text-xs text-[#7A7A7A]">{m.detail}</span>
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 flex items-start gap-2 text-xs text-[#7A7A7A]">
            <ShieldCheck size={14} className="mt-px shrink-0 text-[#111111]" />
            You choose how to pay after each trip. The fare is fixed when you book. Test mode: no real money is
            charged.
          </p>
        </aside>
      </div>
    </div>

    {receiptId && <PaymentReceipt paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </>
  );
}
