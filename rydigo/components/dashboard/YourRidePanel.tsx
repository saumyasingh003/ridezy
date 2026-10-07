"use client";

import { ArrowRight, CheckCircle2 } from "lucide-react";
import { rideOptions, type RideOption } from "./data";

interface YourRidePanelProps {
  ride: RideOption;
  booked: boolean;
  canBook: boolean;
  onSelectRide: (id: string) => void;
  onBook: () => void;
}

export default function YourRidePanel({
  ride,
  booked,
  canBook,
  onSelectRide,
  onBook,
}: YourRidePanelProps) {
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
          const active = option.id === ride.id;
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
                <span className="block text-sm font-bold text-[#111111]">{option.name}</span>
                <span className="block text-xs text-[#7A7A7A]">
                  {option.eta} min away · {option.seats} {option.seats === 1 ? "seat" : "seats"}
                </span>
              </span>

              <span className="text-[15px] font-bold text-[#111111]">₹{option.price}</span>

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

      {/* Footer */}
      <div className="mt-auto pt-8">
        <div className="mb-4 flex items-end justify-between border-t border-dashed border-[#D4D4D4] pt-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
              Total fare
            </p>
            <p className="mt-0.5 text-xs text-[#7A7A7A]">{ride.name} · {ride.eta} min</p>
          </div>
          <p className="font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111]">
            ₹{ride.price}
          </p>
        </div>

        {booked ? (
          <div
            role="status"
            className="flex items-center gap-3 rounded-md bg-[#111111] px-4 py-3.5 text-white"
          >
            <CheckCircle2 size={20} />
            <div>
              <p className="text-sm font-semibold">Ride booked!</p>
              <p className="text-xs text-white/70">
                Your {ride.name.toLowerCase()} arrives in {ride.eta} min.
              </p>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={!canBook}
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
            Book Ride
            <ArrowRight
              size={16}
              strokeWidth={2.25}
              className="transition-transform duration-300 group-hover:translate-x-0.5"
            />
          </button>
        )}
      </div>
    </section>
  );
}
