"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertCircle, Loader2, Star, X } from "lucide-react";
import RateRide, { Stars } from "@/components/ratings/RateRide";
import RidePayment from "./RidePayment";
import { rideOptionFor } from "./data";
import { CURRENT_RIDE_HREF } from "./currentRide";
import { api, formatKm, type RideStatus, type RideView } from "@/lib/rideApi";

interface HistoryPage {
  rides: RideView[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

const PAGE_SIZE = 20;

// Filter tab → server-side ?status= (GET /api/rides/history)
const filters = [
  { label: "All", status: null },
  { label: "Completed", status: "RIDE_COMPLETED" },
  { label: "Cancelled", status: "CANCELLED" },
] as const satisfies readonly { label: string; status: RideStatus | null }[];

type FilterLabel = (typeof filters)[number]["label"];

function historyPath(status: RideStatus | null, page: number, limit = PAGE_SIZE) {
  return `/rides/history?page=${page}&limit=${limit}${status ? `&status=${status}` : ""}`;
}

function statusLabel(status: RideStatus) {
  if (status === "RIDE_COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  return "In progress";
}

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

export default function HistoryView() {
  const [filter, setFilter] = useState<FilterLabel>("All");
  const [list, setList] = useState<{ filter: FilterLabel; data: HistoryPage } | null>(null);
  const [error, setError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [summary, setSummary] = useState<{ total: number; completed: number; spent: number } | null>(null);
  const [rating, setRating] = useState<RideView | null>(null); // ride being rated (modal)
  const [paying, setPaying] = useState<RideView | null>(null); // ride being paid (modal)

  const updateRide = (id: string, patch: Partial<RideView>) =>
    setList((prev) =>
      prev
        ? {
            ...prev,
            data: { ...prev.data, rides: prev.data.rides.map((x) => (x.id === id ? { ...x, ...patch } : x)) },
          }
        : prev
    );

  const status = filters.find((f) => f.label === filter)!.status;
  const loading = list?.filter !== filter;

  // Summary cards: total rides, and completed rides with what they cost.
  useEffect(() => {
    Promise.all([api<HistoryPage>(historyPath(null, 1, 1)), api<HistoryPage>(historyPath("RIDE_COMPLETED", 1, 100))]).then(
      ([all, done]) => {
        if (!all.ok || !done.ok || !all.data || !done.data) return;
        setSummary({
          total: all.data.pagination.total,
          completed: done.data.pagination.total,
          // Paid rides count their charged total (fare + any tip); unpaid ones their fare.
          spent: done.data.rides.reduce(
            (sum, r) => sum + (r.payment?.status === "COMPLETED" ? r.payment.amount : r.finalFare ?? r.estimatedFare),
            0
          ),
        });
      }
    );
  }, []);

  // First page whenever the filter changes.
  useEffect(() => {
    let cancelled = false;
    api<HistoryPage>(historyPath(status, 1)).then(({ ok, data, message }) => {
      if (cancelled) return;
      if (ok && data) {
        setList({ filter, data });
        setError("");
      } else {
        setList({ filter, data: { rides: [], pagination: { page: 1, limit: PAGE_SIZE, total: 0, pages: 0 } } });
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
    const next = list.data.pagination.page + 1;
    const { ok, data, message } = await api<HistoryPage>(historyPath(status, next));
    setLoadingMore(false);
    if (ok && data) {
      setList({ filter, data: { rides: [...list.data.rides, ...data.rides], pagination: data.pagination } });
    } else {
      setError(message);
    }
  };

  const rides = list && !loading ? list.data.rides : [];
  const pagination = list?.data.pagination;
  const hasMore = !loading && pagination ? pagination.page < pagination.pages : false;

  const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-12 space-y-6">
        {/* BANNER — Exact driver banner style */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[195px] sm:h-[220px] lg:h-[240px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/customer-banner2.webp"
              alt="Customer ride history banner"
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
                Trip Log &bull; Ridezy Passenger
              </span>
              <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight mt-1">
                Ride History
              </h1>
              <p className="text-xs sm:text-sm text-white/90 mt-1 sm:mt-1.5 font-medium leading-relaxed drop-shadow-xs">
                Every trip you’ve taken with us, with receipts, driver ratings and live status.
              </p>
            </div>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-1 rounded-xl bg-[#F4F4F4] p-1" role="group" aria-label="Filter trips">
            {filters.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => setFilter(f.label)}
                aria-pressed={filter === f.label}
                className={`rounded-lg px-4 py-2 text-xs sm:text-sm font-semibold transition-all duration-200 cursor-pointer ${
                  filter === f.label
                    ? "bg-[#111111] text-white shadow-xs"
                    : "text-[#5A5A5A] hover:bg-white hover:text-[#111111]"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

      {/* Summary */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total trips", value: summary ? String(summary.total) : "—" },
          { label: "Completed", value: summary ? String(summary.completed) : "—" },
          { label: "Total spent", value: summary ? `₹${summary.spent.toLocaleString("en-IN")}` : "—", dark: true },
        ].map((stat) => (
          <div
            key={stat.label}
            className={`rounded-md px-5 py-4 ${stat.dark ? "bg-[#111111] text-white" : "bg-[#F4F4F4]"}`}
          >
            <p
              className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
                stat.dark ? "text-white/60" : "text-[#8A8A8A]"
              }`}
            >
              {stat.label}
            </p>
            <p
              className={`mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight ${
                stat.dark ? "text-white" : "text-[#111111]"
              }`}
            >
              {stat.value}
            </p>
          </div>
        ))}
      </div>

      {/* List */}
      <section className="mt-6 rounded-md border border-[#E8E8E8] bg-white">
        <div className="flex items-center justify-between border-b border-[#E8E8E8] px-5 py-4">
          <p className={eyebrow}>{filter === "All" ? "All trips" : filter}</p>
          <p className="text-xs text-[#8A8A8A]">
            {loading || !pagination ? "…" : `${pagination.total} ${pagination.total === 1 ? "trip" : "trips"}`}
          </p>
        </div>

        <ul className="divide-y divide-[#F0F0F0]">
          {loading && (
            <li className="flex items-center justify-center gap-2 px-5 py-12 text-sm text-[#8A8A8A]">
              <Loader2 size={15} className="animate-spin" /> Loading trips…
            </li>
          )}

          {rides.map((ride) => {
            const option = rideOptionFor(ride.vehicleType);
            const Icon = option.icon;
            const cancelled = ride.status === "CANCELLED";
            const active = ride.status !== "CANCELLED" && ride.status !== "RIDE_COMPLETED";
            const content = (
              <>
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#E0E0E0] bg-white text-[#111111] transition-colors duration-200 group-hover:border-[#111111] group-hover:bg-[#111111] group-hover:text-white">
                  <Icon size={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#111111]">
                    {ride.pickup.address} <span className="text-[#A3A3A3]">→</span> {ride.destination.address}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8A8A8A]">
                    {formatWhen(ride.createdAt)} · {option.name} · {formatKm(ride.distanceKm)}
                    {ride.driver ? ` · ${ride.driver.name}` : ""}
                    <span className="ml-2 font-mono text-[11px] text-[#B0B0B0]">
                      #{ride.id.slice(-6).toUpperCase()}
                    </span>
                  </p>
                  {cancelled && ride.cancelledBy === "SYSTEM" && (
                    <p className="mt-0.5 text-xs text-[#D92D20]">No driver accepted in time</p>
                  )}
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  {/* Completed rides: pay first, then rate (riders only, no deadline) */}
                  {ride.status === "RIDE_COMPLETED" && ride.driver && (
                    ride.payment?.status !== "COMPLETED" ? (
                      <button
                        type="button"
                        onClick={() => setPaying(ride)}
                        className="inline-flex items-center gap-1 rounded-md bg-[#111111] px-2.5 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-black"
                      >
                        {ride.payment?.status === "PENDING" ? "Cash pending" : "Pay"}
                      </button>
                    ) : ride.myRating ? (
                      <Stars score={ride.myRating} size={12} />
                    ) : (
                      <button
                        type="button"
                        onClick={() => setRating(ride)}
                        className="inline-flex items-center gap-1 rounded-md border border-[#111111] px-2.5 py-1 text-[11px] font-semibold text-[#111111] transition-colors hover:bg-[#111111] hover:text-white"
                      >
                        <Star size={11} />
                        Rate
                      </button>
                    )
                  )}

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      cancelled
                        ? "bg-[#FDF3F3] text-[#D92D20]"
                        : active
                        ? "bg-[#111111] text-white"
                        : "bg-[#F4F4F4] text-[#111111]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        cancelled ? "bg-[#D92D20]" : active ? "animate-pulse bg-white" : "bg-[#111111]"
                      }`}
                    />
                    {statusLabel(ride.status)}
                  </span>

                  <span className="w-20 text-right">
                    <span
                      className={`block text-[15px] font-bold ${
                        cancelled ? "text-[#A3A3A3] line-through" : "text-[#111111]"
                      }`}
                    >
                      {/* Payment amount = final total (fare + tip) from the API */}
                      ₹{ride.payment?.amount ?? ride.finalFare ?? ride.estimatedFare}
                    </span>
                    {!cancelled && (ride.payment?.tipAmount ?? 0) > 0 && (
                      <span className="block text-[10px] font-medium text-[#8A8A8A]">
                        incl. ₹{ride.payment?.tipAmount} tip{ride.payment?.tipPaid ? "" : " (pending)"}
                      </span>
                    )}
                  </span>
                </div>
              </>
            );
            const rowClass =
              "group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAFA] sm:flex-row sm:items-center sm:gap-4";
            return (
              <li key={ride.id}>
                {active ? (
                  <Link href={CURRENT_RIDE_HREF} className={rowClass}>
                    {content}
                  </Link>
                ) : (
                  <div className={rowClass}>{content}</div>
                )}
              </li>
            );
          })}

          {!loading && rides.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-[#8A8A8A]">
              {error ? (
                <span className="inline-flex items-center gap-1.5 text-[#B3261E]">
                  <AlertCircle size={14} /> {error}
                </span>
              ) : (
                "No trips here yet."
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

    {/* Pay a past ride (opens the rating straight after a successful payment) */}
    {paying && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Pay for your ride"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
        onClick={() => setPaying(null)}
      >
        <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setPaying(null)}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#7A7A7A] hover:bg-[#F4F4F4] hover:text-[#111111]"
          >
            <X size={16} />
          </button>
          <RidePayment
            ride={paying}
            onPaymentChange={(payment) => {
              updateRide(paying.id, { payment });
              if (payment.status === "COMPLETED") {
                const paid = { ...paying, payment };
                setPaying(null);
                if (paid.myRating == null) setRating(paid);
              } else {
                setPaying({ ...paying, payment });
              }
            }}
          />
        </div>
      </div>
    )}

    {/* Rate a past ride */}
    {rating && rating.driver && (
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Rate your ride"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
        onClick={() => setRating(null)}
      >
        <div className="relative w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setRating(null)}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full text-[#7A7A7A] hover:bg-[#F4F4F4] hover:text-[#111111]"
          >
            <X size={16} />
          </button>
          <RateRide
            rideId={rating.id}
            subject={`${rating.driver.name}, your driver`}
            onRated={(r) => {
              updateRide(rating.id, { myRating: r.score });
              setRating(null);
            }}
          />
        </div>
      </div>
    )}
    </>
  );
}
