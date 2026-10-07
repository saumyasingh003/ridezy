"use client";

import { ArrowUpDown, ChevronRight, LocateFixed, Navigation, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { recentPlaces } from "./data";
import { loadCurrentRideHref } from "./currentRide";

interface BookRidePanelProps {
  pickup: string;
  destination: string;
  onPickupChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onSwap: () => void;
}

export default function BookRidePanel({
  pickup,
  destination,
  onPickupChange,
  onDestinationChange,
  onSwap,
}: BookRidePanelProps) {
  const router = useRouter();

  return (
    <section
      aria-labelledby="book-title"
      className="order-1 flex flex-col border-b border-[#E8E8E8] bg-white px-5 py-6 lg:overflow-y-auto lg:border-b-0 lg:border-r"
    >
      {/* Header */}
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
        New trip
      </p>
      <h1
        id="book-title"
        className="mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111]"
      >
        Book a Ride
      </h1>
      <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

      {/* Route inputs */}
      <div className="relative mt-6">
        {/* Connector */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[19px] top-[30px] bottom-[30px] w-px bg-[#111111]/25"
        />

        <label
          className="
            group
            relative
            flex
            items-center
            gap-3
            border
            border-transparent
            rounded-md
            bg-[#F4F4F4]
            px-3.5
            py-2.5
            transition-colors
            focus-within:border-[#111111]
            focus-within:bg-white
          "
        >
          <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
            <span className="h-1 w-1 rounded-full bg-white" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A8A8A]">
              Pickup
            </span>
            <input
              type="text"
              value={pickup}
              onChange={(e) => onPickupChange(e.target.value)}
              placeholder="Enter pickup location"
              className="w-full truncate bg-transparent text-sm font-semibold text-[#111111] placeholder:font-normal placeholder:text-[#A3A3A3] outline-none"
            />
          </span>
        </label>

        <div className="relative h-2">
          <button
            type="button"
            onClick={onSwap}
            aria-label="Swap pickup and destination"
            className="
              absolute
              right-3
              top-1/2
              z-10
              flex
              h-8
              w-8
              -translate-y-1/2
              items-center
              justify-center
              rounded-md
              bg-[#111111]
              text-white
              shadow-[0_4px_12px_rgba(0,0,0,0.2)]
              transition-transform
              duration-300
              hover:rotate-180
            "
          >
            <ArrowUpDown size={14} strokeWidth={2.25} />
          </button>
        </div>

        <label
          className="
            group
            relative
            flex
            items-center
            gap-3
            border
            border-transparent
            rounded-md
            bg-[#F4F4F4]
            px-3.5
            py-2.5
            transition-colors
            focus-within:border-[#111111]
            focus-within:bg-white
          "
        >
          <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
            <span className="h-1 w-1 rounded-full bg-white" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A8A8A]">
              Destination
            </span>
            <input
              type="text"
              value={destination}
              onChange={(e) => onDestinationChange(e.target.value)}
              placeholder="Where to?"
              className="w-full truncate bg-transparent text-sm font-semibold text-[#111111] placeholder:font-normal placeholder:text-[#A3A3A3] outline-none"
            />
          </span>
        </label>
      </div>

      {/* Current location */}
      <button
        type="button"
        onClick={() => onPickupChange("Current location")}
        className="
          mt-3
          flex
          w-full
          items-center
          gap-2
          px-1
          py-1.5
          text-xs
          font-semibold
          text-[#111111]
          underline-offset-4
          hover:underline
        "
      >
        <LocateFixed size={14} />
        Use current location
      </button>

      {/* Recent */}
      <div className="mt-7 flex items-center gap-3">
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
          Recent
        </h2>
        <div className="h-px flex-1 bg-[#E8E8E8]" />
      </div>

      <ul className="mt-3 space-y-1">
        {recentPlaces.map((place) => {
          const Icon = place.icon;
          const selected = destination === place.address;
          return (
            <li key={place.label}>
              <button
                type="button"
                onClick={() => onDestinationChange(place.address)}
                aria-pressed={selected}
                className={`
                  group
                  flex
                  w-full
                  items-center
                  gap-3
                  border-l-2
                  px-2.5
                  py-2.5
                  text-left
                  transition-colors
                  duration-200
                  ${
                    selected
                      ? "border-[#111111] bg-[#F4F4F4]"
                      : "border-transparent hover:bg-[#F7F7F7]"
                  }
                `}
              >
                <span
                  className={`
                    flex
                    h-9
                    w-9
                    shrink-0
                    items-center
                    justify-center
                    border
                    transition-colors
                    duration-200
                    ${
                      selected
                        ? "border-[#111111] bg-[#111111] text-white"
                        : "border-[#E0E0E0] bg-white text-[#111111] group-hover:border-[#111111] group-hover:bg-[#111111] group-hover:text-white"
                    }
                  `}
                >
                  <Icon size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-[#111111]">
                    {place.label}
                  </span>
                  <span className="block truncate text-xs text-[#7A7A7A]">
                    {place.address}
                  </span>
                </span>
                <ChevronRight
                  size={15}
                  className="shrink-0 text-[#111111] opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100"
                />
              </button>
            </li>
          );
        })}
      </ul>

      {/* Current ride + Settings */}
      <div className="mt-auto space-y-2 pt-8">
        <button
          type="button"
          onClick={() => router.push(loadCurrentRideHref())}
          className="
            group
            flex
            w-full
            items-center
            gap-3
            rounded-md
            border
            border-[#111111]
            bg-white
            px-3.5
            py-3
            text-sm
            font-semibold
            text-[#111111]
            transition-colors
            duration-200
            hover:bg-[#F4F4F4]
          "
        >
          <Navigation
            size={17}
            className="transition-transform duration-300 group-hover:rotate-45"
          />
          Current Ride
          <span className="relative ml-auto flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#111111] opacity-40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-[#111111]" />
          </span>
          <ChevronRight size={15} className="opacity-60" />
        </button>

        <button
          type="button"
          className="
            group
            flex
            w-full
            items-center
            gap-3
            rounded-md
            bg-[#111111]
            px-3.5
            py-3
            text-sm
            font-semibold
            text-white
            shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]
            transition-colors
            duration-200
            hover:bg-black
          "
        >
          <Settings
            size={17}
            className="transition-transform duration-500 group-hover:rotate-90"
          />
          Settings
          <ChevronRight size={15} className="ml-auto opacity-60" />
        </button>
      </div>
    </section>
  );
}
