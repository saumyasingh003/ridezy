"use client";

import { Car, Loader2 } from "lucide-react";
import { formatDuration, formatKm, type RideView } from "@/lib/rideApi";

function minutesAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : `${m} min ago`;
}

/** One ride offered to the driver (GET /api/drivers/rides/requests), with Accept / Decline. */
export default function RideOfferCard({
  offer,
  busy,
  disabled,
  onAccept,
  onDecline,
  compact = false,
}: {
  offer: RideView;
  /** This offer's accept/decline is in flight. */
  busy: boolean;
  /** Any accept/decline is in flight. */
  disabled: boolean;
  onAccept: (offer: RideView) => void;
  onDecline: (offer: RideView) => void;
  /** Lighter styling for use inside another card (driver dashboard). */
  compact?: boolean;
}) {
  return (
    <div
      className={`animate-in fade-in slide-in-from-bottom-2 duration-300 border ${
        compact
          ? "rounded-xl border-emerald-200 bg-[#FAFAF8] p-4 sm:p-5 space-y-4"
          : "rounded-2xl sm:rounded-3xl border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-5"
      }`}
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#F0EFEA]">
        <div className="flex items-center gap-3">
          <div className="relative w-12 h-12 rounded-2xl bg-neutral-100 border border-neutral-200 flex items-center justify-center shrink-0">
            <Car className="w-5 h-5 text-black" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500" />
            </span>
          </div>
          <div>
            <h2 className={`font-caslon font-bold text-[#111111] ${compact ? "text-lg" : "text-xl sm:text-2xl"}`}>
              Incoming Ride Request
            </h2>
            <p className="text-xs text-stone-500 mt-0.5">
              {offer.passenger?.name || "Passenger"} &bull; requested {minutesAgo(offer.createdAt)}
              {typeof offer.distanceToPickupKm === "number" && ` • ${formatKm(offer.distanceToPickupKm)} from you`}
            </p>
          </div>
        </div>
        <div className="text-left sm:text-right shrink-0">
          <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Est. Fare</p>
          <p className={`font-caslon font-bold text-[#111111] mt-0.5 ${compact ? "text-2xl" : "text-2xl sm:text-3xl"}`}>
            ₹{offer.estimatedFare}
          </p>
          {(offer.tipAmount ?? 0) > 0 && (
            <span className="mt-1 inline-block rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
              +₹{offer.tipAmount} tip
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-start gap-3">
          <div className="mt-1 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pickup</p>
            <p className="text-sm font-bold text-black mt-0.5">{offer.pickup.address}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <div className="mt-1 w-3.5 h-3.5 rounded-full bg-black ring-4 ring-neutral-200 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Drop</p>
            <p className="text-sm font-bold text-black mt-0.5">{offer.destination.address}</p>
            <p className="text-xs text-stone-500 mt-0.5">
              {formatKm(offer.distanceKm)} trip &bull; ~{formatDuration(offer.estimatedDurationMinutes)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onDecline(offer)}
          disabled={disabled}
          className="w-full py-3 rounded-xl border border-stone-200 text-stone-700 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Decline
        </button>
        <button
          type="button"
          onClick={() => onAccept(offer)}
          disabled={disabled}
          className="w-full py-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          Accept Ride (₹{offer.estimatedFare})
        </button>
      </div>
    </div>
  );
}
