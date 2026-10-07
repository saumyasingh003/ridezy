"use client";

import { useState } from "react";
import Image from "next/image";
import { Bike, CarFront, Truck, Crown, Star, Download, type LucideIcon } from "lucide-react";

type Status = "Completed" | "Cancelled";

interface Trip {
  id: string;
  from: string;
  to: string;
  date: string;
  type: "Bike" | "Auto" | "Standard" | "Premium";
  fare: number;
  distance: string;
  status: Status;
  rating?: number;
}

const typeIcon: Record<Trip["type"], LucideIcon> = {
  Bike,
  Auto: Truck,
  Standard: CarFront,
  Premium: Crown,
};

const trips: Trip[] = [
  { id: "RZ-10482", from: "MG Road", to: "Electronic City", date: "Today, 9:12 AM", type: "Standard", fare: 284, distance: "12.4 km", status: "Completed", rating: 5 },
  { id: "RZ-10471", from: "Indiranagar", to: "Koramangala", date: "Yesterday, 7:40 PM", type: "Bike", fare: 62, distance: "5.1 km", status: "Completed", rating: 5 },
  { id: "RZ-10455", from: "HSR Layout", to: "Whitefield", date: "Oct 2, 8:05 AM", type: "Auto", fare: 148, distance: "14.8 km", status: "Completed", rating: 4 },
  { id: "RZ-10440", from: "Jayanagar", to: "Majestic", date: "Oct 1, 6:22 PM", type: "Bike", fare: 55, distance: "6.3 km", status: "Cancelled" },
  { id: "RZ-10426", from: "Hebbal", to: "Kempegowda Airport", date: "Sep 29, 5:10 AM", type: "Premium", fare: 812, distance: "28.2 km", status: "Completed", rating: 5 },
  { id: "RZ-10411", from: "BTM Layout", to: "Bannerghatta Road", date: "Sep 27, 1:45 PM", type: "Auto", fare: 96, distance: "4.7 km", status: "Completed", rating: 4 },
];

const filters = ["All", "Completed", "Cancelled"] as const;

export default function HistoryView() {
  const [filter, setFilter] = useState<(typeof filters)[number]>("All");

  const visible = filter === "All" ? trips : trips.filter((t) => t.status === filter);
  const completed = trips.filter((t) => t.status === "Completed");
  const totalSpent = completed.reduce((sum, t) => sum + t.fare, 0);

  const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";

  return (
    <>
    {/* Banner — full width, sized to the image so nothing is cropped on desktop */}
    <div className="relative aspect-[2070/408] min-h-40 w-full overflow-hidden bg-[#F6EFDD]">
      <Image
        src="/ride-history-banner.webp"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
    </div>

    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      {/* Header — same style as the dashboard panels */}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className={eyebrow}>Your trips</p>
          <h1 className="mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111] sm:text-4xl">
            Ride History
          </h1>
          <div className="mt-3 h-[3px] w-10 bg-[#111111]" />
        </div>

        <div className="flex gap-1 rounded-md bg-[#F4F4F4] p-1" role="group" aria-label="Filter trips">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                filter === f
                  ? "bg-[#111111] text-white shadow-[0_4px_12px_-4px_rgba(0,0,0,0.4)]"
                  : "text-[#5A5A5A] hover:bg-white hover:text-[#111111]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {[
          { label: "Total trips", value: String(trips.length) },
          { label: "Completed", value: String(completed.length) },
          { label: "Total spent", value: `₹${totalSpent.toLocaleString("en-IN")}`, dark: true },
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
            {visible.length} {visible.length === 1 ? "trip" : "trips"}
          </p>
        </div>

        <ul className="divide-y divide-[#F0F0F0]">
          {visible.map((trip) => {
            const Icon = typeIcon[trip.type];
            const cancelled = trip.status === "Cancelled";
            return (
              <li
                key={trip.id}
                className="group flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-[#FAFAFA] sm:flex-row sm:items-center sm:gap-4"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-[#E0E0E0] bg-white text-[#111111] transition-colors duration-200 group-hover:border-[#111111] group-hover:bg-[#111111] group-hover:text-white">
                  <Icon size={18} />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold text-[#111111]">
                    {trip.from} <span className="text-[#A3A3A3]">→</span> {trip.to}
                  </p>
                  <p className="mt-0.5 text-xs text-[#8A8A8A]">
                    {trip.date} · {trip.type} · {trip.distance}
                    <span className="ml-2 font-mono text-[11px] text-[#B0B0B0]">{trip.id}</span>
                  </p>
                </div>

                <div className="flex items-center gap-4 sm:gap-5">
                  {trip.rating ? (
                    <div className="flex gap-0.5" aria-label={`Rated ${trip.rating} out of 5`}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={12}
                          className={i < trip.rating! ? "fill-[#111111] text-[#111111]" : "text-[#D4D4D4]"}
                        />
                      ))}
                    </div>
                  ) : null}

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      cancelled
                        ? "bg-[#FDF3F3] text-[#D92D20]"
                        : "bg-[#F4F4F4] text-[#111111]"
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${cancelled ? "bg-[#D92D20]" : "bg-[#111111]"}`}
                    />
                    {trip.status}
                  </span>

                  <span
                    className={`w-14 text-right text-[15px] font-bold ${
                      cancelled ? "text-[#A3A3A3] line-through" : "text-[#111111]"
                    }`}
                  >
                    ₹{trip.fare}
                  </span>

                  <button
                    type="button"
                    aria-label={`Download receipt for ${trip.id}`}
                    className="flex h-9 w-9 items-center justify-center rounded-md text-[#5A5A5A] transition-colors hover:bg-[#111111] hover:text-white"
                  >
                    <Download size={16} />
                  </button>
                </div>
              </li>
            );
          })}

          {visible.length === 0 && (
            <li className="px-5 py-12 text-center text-sm text-[#8A8A8A]">No trips here yet.</li>
          )}
        </ul>
      </section>
    </div>
    </>
  );
}
