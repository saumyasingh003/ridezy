"use client";

import { AlertCircle, ArrowRight, Loader2, Navigation } from "lucide-react";
import { rideOptions, rideOptionFor } from "./data";
import type { EstimateState } from "./RideBooker";
import {
  formatDuration,
  formatKm,
  type NearbyAvailability,
  type RideView,
  type VehicleType,
} from "@/lib/rideApi";

interface YourRidePanelProps {
  vehicleType: VehicleType;
  estimates: EstimateState;
  canBook: boolean;
  booking: boolean;
  bookError: string;
  activeRide: RideView | null;
  /** Drivers near the pickup per type; null until a pickup is chosen. */
  availability: NearbyAvailability | null;
  onSelectRide: (id: VehicleType) => void;
  onBook: () => void;
  onViewActiveRide: () => void;
}

export default function YourRidePanel({
  vehicleType,
  estimates,
  canBook,
  booking,
  bookError,
  activeRide,
  availability,
  onSelectRide,
  onBook,
  onViewActiveRide,
}: YourRidePanelProps) {
  const ride = rideOptionFor(vehicleType);
  const selected = estimates.status === "ready" ? estimates.byType[vehicleType] : undefined;
  const selectedNearby = availability?.byType[vehicleType];
  const alternative = availability
    ? rideOptions.find((o) => o.id !== vehicleType && availability.byType[o.id].count > 0)
    : undefined;

  return (
    <section
      aria-labelledby="your-ride-title"
      className="order-3 flex flex-col border-t border-[#E8E8E8] bg-white px-5 py-6 lg:overflow-y-auto lg:border-l lg:border-t-0"
    >
      {/* Header */}
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
        Ride type
      </p>
      <h2
        id="your-ride-title"
        className="mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111]"
      >
        Choose Your Vehicle
      </h2>
      <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

      {/* Options */}
      <div className="mt-6 space-y-2" role="radiogroup" aria-label="Ride type">
        {rideOptions.map((option) => {
          const Icon = option.icon;
          const active = option.id === vehicleType;
          const estimate = estimates.status === "ready" ? estimates.byType[option.id] : undefined;
          const near = availability?.byType[option.id];
          const none = near?.count === 0;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onSelectRide(option.id)}
              className={`
                group
                flex
                w-full
                items-center
                gap-3
                rounded-md
                border
                px-3
                py-3
                text-left
                transition-all
                duration-200
                ${
                  active
                    ? "border-[#111111] bg-white shadow-[0_6px_16px_-8px_rgba(0,0,0,0.35)]"
                    : "border-transparent bg-[#F4F4F4] hover:bg-[#EDEDED]"
                }
              `}
            >
              <span
                className={`
                  flex
                  h-10
                  w-10
                  shrink-0
                  items-center
                  justify-center
                  rounded-md
                  transition-colors
                  duration-200
                  ${
                    active
                      ? "bg-[#111111] text-white"
                      : "bg-white text-[#111111] group-hover:bg-[#111111] group-hover:text-white"
                  }
                `}
              >
                <Icon size={18} />
              </span>

              <span className="min-w-0 flex-1">
                <span className={`block text-sm font-bold ${none ? "text-[#A3A3A3]" : "text-[#111111]"}`}>
                  {option.name}
                </span>
                <span className="block text-xs text-[#7A7A7A]">
                  {estimate ? `${formatDuration(estimate.durationMinutes)} trip · ` : ""}
                  {option.seats} {option.seats === 1 ? "seat" : "seats"}
                </span>
                {near && (
                  <span
                    className={`mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold ${
                      none ? "text-[#B3261E]" : "text-emerald-700"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${none ? "bg-[#D92D20]" : "bg-emerald-500"}`} />
                    {none
                      ? "None nearby"
                      : `${near.count} nearby${near.etaMinutes ? ` · ~${near.etaMinutes} min away` : ""}`}
                  </span>
                )}
              </span>

              <span className="text-[15px] font-bold text-[#111111]">
                {estimates.status === "loading" ? (
                  <Loader2 size={15} className="animate-spin text-[#7A7A7A]" />
                ) : estimate ? (
                  `₹${estimate.estimatedFare}`
                ) : (
                  <span className="text-[#A3A3A3]">—</span>
                )}
              </span>

              <span
                aria-hidden="true"
                className={`
                  flex
                  h-4
                  w-4
                  shrink-0
                  items-center
                  justify-center
                  rounded-full
                  border-[1.5px]
                  ${active ? "border-[#111111]" : "border-[#C4C4C4]"}
                `}
              >
                {active && <span className="h-2 w-2 rounded-full bg-[#111111]" />}
              </span>
            </button>
          );
        })}
      </div>

      {estimates.status === "idle" && (
        <p className="mt-4 text-xs text-[#7A7A7A]">
          Pick a pickup and destination from the suggestions to see fares.
        </p>
      )}
      {estimates.status === "error" && (
        <p role="alert" className="mt-4 flex items-start gap-1.5 text-xs font-medium text-[#B3261E]">
          <AlertCircle size={14} className="mt-px shrink-0" />
          {estimates.message}
        </p>
      )}

      {/* Footer */}
      <div className="mt-auto pt-8">
        <div className="mb-4 flex items-end justify-between border-t border-dashed border-[#D4D4D4] pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
              Estimated fare
            </p>
            <p className="mt-0.5 text-xs text-[#7A7A7A]">
              {ride.name}
              {selected ? ` · ${formatKm(selected.distanceKm)} · ${formatDuration(selected.durationMinutes)}` : ""}
            </p>
          </div>
          <p className="font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111]">
            {selected ? `₹${selected.estimatedFare}` : "—"}
          </p>
        </div>

        {selected && (
          <p className="-mt-2 mb-4 text-[11px] text-[#8A8A8A]">
            Base ₹{selected.fareBreakdown.baseFare} + distance ₹{selected.fareBreakdown.distanceFare}
            {" "}(min ₹{selected.fareBreakdown.minimumFare})
            {selected.routeSource === "ESTIMATED" ? " · approximate route" : ""}
          </p>
        )}

        {bookError && (
          <p role="alert" className="mb-3 flex items-start gap-1.5 text-xs font-medium text-[#B3261E]">
            <AlertCircle size={14} className="mt-px shrink-0" />
            {bookError}
          </p>
        )}

        {!activeRide && selectedNearby?.count === 0 && (
          <p role="status" className="mb-3 rounded-md bg-[#FFF8E6] px-3.5 py-2.5 text-xs text-[#8A5A00]">
            {availability?.matchAllDrivers
              ? "No drivers are online right now. You can still book; we'll keep searching."
              : `No ${ride.name.toLowerCase()} drivers within ${availability?.radiusKm} km of your pickup right now. You can still book; we'll keep searching.`}
            {alternative ? (
              <>
                {" "}
                <button
                  type="button"
                  onClick={() => onSelectRide(alternative.id)}
                  className="font-semibold underline underline-offset-2"
                >
                  Try {alternative.name}
                </button>
              </>
            ) : (
              ""
            )}
          </p>
        )}

        {activeRide ? (
          <button
            type="button"
            onClick={onViewActiveRide}
            className="flex w-full items-center gap-3 rounded-md bg-[#111111] px-4 py-3.5 text-left text-white transition-colors hover:bg-black"
          >
            <Navigation size={20} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">You have an active ride</span>
              <span className="block truncate text-xs text-white/70">
                {activeRide.pickup.address} → {activeRide.destination.address}
              </span>
            </span>
            <ArrowRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            disabled={!canBook || booking}
            onClick={onBook}
            className="
              group
              flex
              w-full
              items-center
              justify-center
              gap-2
              rounded-md
              bg-[#111111]
              py-3.5
              text-[15px]
              font-semibold
              text-white
              shadow-[0_8px_18px_-6px_rgba(0,0,0,0.45)]
              transition-all
              duration-300
              hover:bg-black
              active:scale-[0.99]
              disabled:cursor-not-allowed
              disabled:opacity-40
            "
          >
            {booking ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Booking…
              </>
            ) : (
              <>
                Book {ride.name}
                <ArrowRight
                  size={16}
                  strokeWidth={2.25}
                  className="transition-transform duration-300 group-hover:translate-x-0.5"
                />
              </>
            )}
          </button>
        )}
      </div>
    </section>
  );
}
