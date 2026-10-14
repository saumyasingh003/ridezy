"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";
import {
  AlertCircle,
  Award,
  Banknote,
  Clock,
  CreditCard,
  Loader2,
  Smartphone,
  Sparkles,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import PendingCashPayments from "@/components/driver/PendingCashPayments";
import PaymentReceipt from "@/components/payments/PaymentReceipt";
import {
  api,
  PAYMENT_METHOD_LABELS,
  type PaymentHistory,
  type PaymentMethod,
  type PaymentStatus,
  type PaymentView,
} from "@/lib/rideApi";

// Everything here comes from GET /api/payments/history (payments this driver received).
const PAGE_SIZE = 20;
// Recent paid payments used for today / last-7-days / method split.
const RECENT_PAID_PATH = "/payments/history?status=COMPLETED&limit=100";

const METHOD_ICON: Record<PaymentMethod, LucideIcon> = { UPI: Smartphone, CARD: CreditCard, CASH: Banknote };

const STATUS_STYLE: Record<PaymentStatus, { label: string; className: string }> = {
  COMPLETED: { label: "PAID", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  PENDING: { label: "CASH DUE", className: "bg-amber-50 text-amber-800 border-amber-200" },
  FAILED: { label: "FAILED", className: "bg-rose-50 text-rose-700 border-rose-200" },
  REFUNDED: { label: "REFUNDED", className: "bg-stone-100 text-stone-700 border-stone-200" },
};

function dayKey(d: Date) {
  return d.toDateString();
}

function inr(n: number) {
  return `₹${n.toLocaleString("en-IN")}`;
}

export default function DriverEarningsPage() {
  const [recentPaid, setRecentPaid] = useState<PaymentView[] | null>(null);
  const [list, setList] = useState<PaymentHistory | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [completedRideStats, setCompletedRideStats] = useState<{ count: number; totalFare: number } | null>(null);

  useEffect(() => {
    api<PaymentHistory>(RECENT_PAID_PATH).then(({ ok, data }) => setRecentPaid(ok && data ? data.payments : []));
    api<PaymentHistory>(`/payments/history?page=1&limit=${PAGE_SIZE}`).then(({ ok, data, message }) => {
      if (ok && data) {
        setList(data);
        setError("");
      } else {
        setError(message);
      }
    });
    api<Array<{ status: string; rawFare: number }>>("/drivers/rides/history").then(({ ok, data }) => {
      if (ok && Array.isArray(data)) {
        const completed = data.filter((r) => r.status === "RIDE_COMPLETED");
        const totalFare = completed.reduce((sum, r) => sum + (Number(r.rawFare) || 0), 0);
        setCompletedRideStats({ count: completed.length, totalFare });
      }
    });
  }, [refreshKey]);

  const loadMore = async () => {
    if (!list) return;
    setLoadingMore(true);
    const { ok, data, message } = await api<PaymentHistory>(
      `/payments/history?page=${list.pagination.page + 1}&limit=${PAGE_SIZE}`
    );
    setLoadingMore(false);
    if (ok && data) setList({ ...data, payments: [...list.payments, ...data.payments] });
    else setError(message);
  };

  /* ---------- Derived numbers (from real payments) ---------- */
  const paid = recentPaid ?? [];
  const today = new Date();
  const todayKey = dayKey(today);
  const todays = paid.filter((p) => {
    const d = p.paidAt || p.createdAt;
    return d && dayKey(new Date(d)) === todayKey;
  });
  const todayTotal = todays.reduce((s, p) => s + p.amount, 0);

  // Last 7 days, oldest → today.
  const week = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i));
    const key = dayKey(d);
    const dayPayments = paid.filter((p) => {
      const ts = p.paidAt || p.createdAt;
      return ts && dayKey(new Date(ts)) === key;
    });
    return {
      key,
      label: i === 6 ? "Today" : d.toLocaleDateString("en-IN", { weekday: "short" }),
      amount: dayPayments.reduce((s, p) => s + p.amount, 0),
      trips: dayPayments.length,
    };
  });
  const weekTotal = week.reduce((s, d) => s + d.amount, 0);
  const weekTrips = week.reduce((s, d) => s + d.trips, 0);
  const maxDay = Math.max(...week.map((d) => d.amount), 1);
  const peak = week.reduce((best, d) => (d.amount > best.amount ? d : best), week[0]);

  const byMethod = (["UPI", "CARD", "CASH"] as const).map((m) => {
    const items = paid.filter((p) => p.method === m);
    return { method: m, amount: items.reduce((s, p) => s + p.amount, 0), count: items.length };
  });
  const methodTotal = byMethod.reduce((s, m) => s + m.amount, 0);

  const summary = list?.summary;
  const loading = recentPaid === null || list === null;
  const hasMore = list ? list.pagination.page < list.pagination.pages : false;

  // Derive robust driver totals: server summary > payment list items > completed rides total
  const completedPayments = (list?.payments ?? []).filter((p) => p.status === "COMPLETED");
  const fallbackPaidAmount = completedPayments.reduce((s, p) => s + p.amount, 0);
  const totalEarnedAmount =
    summary && summary.paidAmount > 0
      ? summary.paidAmount
      : fallbackPaidAmount > 0
      ? fallbackPaidAmount
      : completedRideStats?.totalFare ?? 0;
  const totalEarnedCount =
    summary && summary.paidCount > 0
      ? summary.paidCount
      : completedPayments.length > 0
      ? completedPayments.length
      : completedRideStats?.count ?? 0;
  // Fares vs tips (tips are 100% the driver's). Older backends: everything counts as fares.
  const paidFares = summary ? summary.paidFares ?? summary.paidAmount : 0;
  const paidTips = summary?.paidTips ?? 0;

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24 text-black">
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 space-y-6">

        {/* 1. EARNINGS BANNER */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[170px] sm:h-[190px] lg:h-[205px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/smiling-driver-banner.webp"
              alt="Driver earnings banner"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "center 15%" }}
            />
          </div>

          <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 flex flex-col justify-center">
            <div className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#555550]">
                Ride Payments &bull; Ridezy Partner
              </span>
              <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111111] tracking-tight leading-tight mt-1">
                Driver Earnings
              </h1>
              <p className="text-xs sm:text-sm text-zinc-700 mt-1 sm:mt-1.5 font-medium leading-relaxed">
                What passengers paid you for completed rides: online payments and cash you confirmed.
              </p>
            </div>
          </div>
        </div>

        {/* Cash waiting for confirmation */}
        <PendingCashPayments onConfirmed={() => setRefreshKey((k) => k + 1)} />

        {/* 2. STATS GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Total Earned",
              icon: Award,
              accent: "bg-emerald-50 text-emerald-700 border-emerald-200",
              value: list ? inr(totalEarnedAmount) : "—",
              note: `${totalEarnedCount} paid ${totalEarnedCount === 1 ? "ride" : "rides"}${
                summary ? ` • ${inr(paidFares)} fares + ${inr(paidTips)} tips` : ""
              }`,
            },
            {
              label: "Today",
              icon: Clock,
              accent: "bg-neutral-100 text-black border-neutral-200",
              value: recentPaid ? inr(todayTotal) : "—",
              note: `${todays.length} ${todays.length === 1 ? "trip" : "trips"}${
                todays.length ? ` • ${inr(Math.round(todayTotal / todays.length))} avg` : ""
              }`,
            },
            {
              label: "Last 7 Days",
              icon: TrendingUp,
              accent: "bg-neutral-100 text-black border-neutral-200",
              value: recentPaid ? inr(weekTotal) : "—",
              note: `${weekTrips} paid ${weekTrips === 1 ? "ride" : "rides"}`,
            },
            {
              label: "Cash To Collect",
              icon: Wallet,
              accent: "bg-amber-50 text-amber-800 border-amber-200",
              value: summary ? inr(summary.pendingAmount) : "—",
              note: summary?.pendingCount
                ? `${summary.pendingCount} awaiting your confirmation`
                : "Nothing pending",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.label}
                className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-5 sm:p-6 shadow-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">{card.label}</span>
                  <span className={`p-2 rounded-xl border ${card.accent}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                </div>
                <p className="font-caslon text-2xl sm:text-3xl font-bold text-black mt-2">{card.value}</p>
                <p className="text-xs text-stone-500 mt-1">{card.note}</p>
              </div>
            );
          })}
        </div>

        {/* 3. WEEKLY CHART & METHOD SPLIT (COMPACT & MONOCHROME) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Last 7 Days Chart */}
          <section className="lg:col-span-8 rounded-2xl border border-[#EDEDE8] bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F0EFEA]">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-caslon text-lg sm:text-xl font-bold text-black">Last 7 Days</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full">
                    Activity
                  </span>
                </div>
                <p className="text-xs text-stone-500 mt-0.5">
                  Total <span className="font-semibold text-black">{inr(weekTotal)}</span> &bull;{" "}
                  {weekTrips} {weekTrips === 1 ? "ride" : "rides"}
                </p>
              </div>

              {peak.amount > 0 && (
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-stone-100 border border-stone-200 text-stone-800 text-xs font-semibold">
                  <span>
                    Best: <strong className="font-bold text-black">{peak.label}</strong> ({inr(peak.amount)})
                  </span>
                </div>
              )}
            </div>

            {/* Chart Area with Taller Bars */}
            <div className="pt-2 pb-2">
              <div className="grid grid-cols-7 gap-2 sm:gap-3 items-end min-h-[195px]">
                {week.map((d) => {
                  const isToday = d.label === "Today";
                  const hasAmount = d.amount > 0;
                  const heightPct = hasAmount ? Math.max(16, (d.amount / maxDay) * 100) : 0;

                  return (
                    <div
                      key={d.key}
                      className="group relative flex flex-col items-center justify-end select-none"
                    >
                      {/* Tooltip on hover */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none absolute -top-2 z-20 transition-all duration-150 transform group-hover:-translate-y-1 bg-black text-white text-[10px] font-mono font-medium py-0.5 px-2 rounded shadow-md whitespace-nowrap">
                        {d.trips} {d.trips === 1 ? "ride" : "rides"} &bull; {inr(d.amount)}
                      </div>

                      {/* Value tag above bar */}
                      <div className="h-5 flex items-center justify-center mb-1.5">
                        {hasAmount ? (
                          <span
                            className={`text-[10px] sm:text-[11px] font-mono font-bold ${
                              isToday ? "text-black" : "text-stone-700"
                            }`}
                          >
                            {inr(d.amount)}
                          </span>
                        ) : (
                          <span className="text-[10px] text-stone-300 font-mono">
                            —
                          </span>
                        )}
                      </div>

                      {/* Taller slim pill track */}
                      <div className="w-full max-w-[26px] sm:max-w-[32px] h-28 sm:h-32 bg-stone-100 rounded-full p-0.5 flex items-end justify-center">
                        {hasAmount ? (
                          <div
                            style={{ height: `${heightPct}%` }}
                            className={`w-full rounded-full transition-all duration-300 ${
                              isToday ? "bg-black" : "bg-stone-800 hover:bg-black"
                            }`}
                          />
                        ) : (
                          <div className="w-1.5 h-1.5 rounded-full bg-stone-300 mb-1" />
                        )}
                      </div>

                      {/* Day Label */}
                      <div className="mt-2.5 flex items-center justify-center">
                        {isToday ? (
                          <span className="text-[9px] font-bold text-white bg-black px-1.5 py-0.5 rounded-full">
                            Today
                          </span>
                        ) : (
                          <span className="text-[10px] font-semibold text-stone-400 group-hover:text-black transition-colors">
                            {d.label}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* How You Were Paid Section */}
          <section className="lg:col-span-4 rounded-2xl border border-[#EDEDE8] bg-white p-4 sm:p-5 shadow-xs flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#F0EFEA]">
                <div>
                  <h4 className="font-caslon text-base font-bold text-black">How You Were Paid</h4>
                  <p className="text-[11px] text-stone-500 mt-0.5">Split of recent paid rides</p>
                </div>
                <span className="font-caslon text-base font-bold text-black">
                  {inr(methodTotal)}
                </span>
              </div>

              {/* Minimalist Monochrome Multi-segment Bar */}
              <div className="mt-3 mb-3">
                <div className="h-1.5 w-full bg-stone-100 rounded-full overflow-hidden flex gap-0.5">
                  {methodTotal > 0 ? (
                    byMethod.map((m, idx) => {
                      const pct = Math.round((m.amount / methodTotal) * 100);
                      if (pct <= 0) return null;
                      const barBg = idx === 0 ? "bg-black" : idx === 1 ? "bg-stone-600" : "bg-stone-400";
                      return (
                        <div
                          key={m.method}
                          style={{ width: `${pct}%` }}
                          className={`h-full rounded-full transition-all duration-300 ${barBg}`}
                          title={`${PAYMENT_METHOD_LABELS[m.method]}: ${pct}% (${inr(m.amount)})`}
                        />
                      );
                    })
                  ) : (
                    <div className="w-full h-full rounded-full bg-stone-200" />
                  )}
                </div>
              </div>

              {/* Clean Minimal Rows (No chunky box wrappers) */}
              <div className="divide-y divide-stone-100">
                {byMethod.map((m) => {
                  const Icon = METHOD_ICON[m.method];
                  const pct = methodTotal ? Math.round((m.amount / methodTotal) * 100) : 0;

                  return (
                    <div key={m.method} className="py-2.5 first:pt-1 last:pb-1 space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="p-1 rounded-md bg-stone-100 text-stone-700">
                            <Icon className="w-3.5 h-3.5" />
                          </span>
                          <span className="font-semibold text-black">
                            {PAYMENT_METHOD_LABELS[m.method]}
                          </span>
                          <span className="text-[10px] text-stone-400 font-normal">
                            ({m.count} {m.count === 1 ? "ride" : "rides"})
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-black">{inr(m.amount)}</span>
                          <span className="text-[10px] font-semibold text-stone-400 w-7 text-right">
                            {pct}%
                          </span>
                        </div>
                      </div>

                      {/* Sleek monochrome progress track */}
                      <div className="w-full bg-stone-100 h-1 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-black transition-all duration-300"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[10px] text-stone-400 pt-2.5 border-t border-[#F0EFEA] flex items-center justify-between mt-3">
              <span>Settlement: Direct & Verified</span>
              <span className="font-medium text-black">100% payout</span>
            </p>
          </section>
        </div>

        {/* 4. PAYMENTS RECEIVED */}
        <section className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-[#F0EFEA]">
            <div>
              <h3 className="font-caslon text-xl font-bold text-[#111111]">Payments Received</h3>
              <p className="text-xs text-stone-500 mt-0.5">Every payment for your rides. Tap one for its receipt.</p>
            </div>
            {list && (
              <span className="text-xs font-semibold text-stone-500">{list.pagination.total} total</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-xs text-stone-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Loading payments…
            </div>
          ) : list && list.payments.length > 0 ? (
            <div className="divide-y divide-[#F0EFEA]">
              {list.payments.map((p) => {
                const Icon = METHOD_ICON[p.method];
                const style = STATUS_STYLE[p.status];
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setReceiptId(p.id)}
                    className="w-full py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-left text-xs hover:bg-[#FAFAF8] rounded-xl px-2 -mx-2 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
                        <Icon className="w-4 h-4 text-stone-700" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-black truncate">
                          {p.passenger?.name || "Passenger"} &bull; {PAYMENT_METHOD_LABELS[p.method]}
                        </p>
                        <p className="text-[11px] text-stone-500 truncate">
                          {p.ride ? `${p.ride.pickup} → ${p.ride.destination}` : "Ride payment"} &bull;{" "}
                          {new Date(p.paidAt ?? p.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded-md border ${style.className}`}>
                        {style.label}
                      </span>
                      <span className="flex flex-col items-end">
                        <span
                          className={`font-caslon text-base font-bold ${
                            p.status === "FAILED" ? "text-stone-400 line-through" : "text-black"
                          }`}
                        >
                          {inr(p.amount)}
                        </span>
                        {/* Fare and tip shown separately; the total above is the API amount */}
                        {p.status !== "FAILED" && (p.tipAmount ?? 0) > 0 && (
                          <span className="text-[11px] text-stone-500">
                            {p.breakdown ? `${inr(p.breakdown.baseFare)} fare + ` : ""}
                            {inr(p.tipAmount ?? 0)} tip{p.tipPaid ? "" : " (pending)"}
                          </span>
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="py-10 text-center text-xs text-stone-400">
              {error ? (
                <span className="inline-flex items-center gap-1.5 text-rose-700">
                  <AlertCircle className="w-3.5 h-3.5" /> {error}
                </span>
              ) : (
                "No payments yet. Complete a ride and they will show up here."
              )}
            </div>
          )}

          {hasMore && (
            <div className="text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-stone-200 text-xs font-semibold text-black hover:bg-stone-50 transition-colors disabled:opacity-50"
              >
                {loadingMore && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Load more
              </button>
            </div>
          )}
        </section>
      </div>

      {receiptId && <PaymentReceipt paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </div>
  );
}
