"use client";

import { useState } from "react";
import Image from "next/image";
import { Plus, Minus, LocateFixed } from "lucide-react";

// Static map picture. The SVG overlay uses the image's own pixel size as its
// viewBox, and both are cropped the same way (cover, centred), so the route
// stays lined up with the streets in the picture at any panel size.
const MAP_W = 1313;
const MAP_H = 875;

// Route drawn along roads visible in the picture.
const ROUTE = "M440 605 L520 578 L612 545 L744 508 L734 560 L724 615 L713 668 L703 718";
const PICKUP = { x: 440, y: 605 };
const DROP = { x: 703, y: 718 };
const CAR = { x: 612, y: 545 };

const MIN_ZOOM = 1;
const MAX_ZOOM = 2;

export default function RouteMap({
  pickup,
  destination,
}: {
  pickup: string;
  destination: string;
}) {
  const [zoom, setZoom] = useState(1);
  const hasRoute = pickup.trim() !== "" && destination.trim() !== "";

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#F2F0EB]">
      {/* Map + route, zoomed together */}
      <div
        className="absolute inset-0 transition-transform duration-300 ease-out"
        style={{ transform: `scale(${zoom})` }}
      >
        <Image
          src="/map.webp"
          alt="City map"
          fill
          priority
          sizes="(min-width: 1024px) 60vw, 100vw"
          className="object-cover object-center"
        />

        {hasRoute && (
          <svg
            viewBox={`0 0 ${MAP_W} ${MAP_H}`}
            preserveAspectRatio="xMidYMid slice"
            className="absolute inset-0 h-full w-full"
            aria-hidden="true"
          >
            {/* Route */}
            <path d={ROUTE} fill="none" stroke="#111111" strokeOpacity="0.15" strokeWidth="16" strokeLinecap="round" strokeLinejoin="round" />
            <path d={ROUTE} fill="none" stroke="#111111" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />

            {/* Pickup */}
            <circle cx={PICKUP.x} cy={PICKUP.y} r="18" fill="#111111" fillOpacity="0.15" />
            <circle cx={PICKUP.x} cy={PICKUP.y} r="10" fill="#111111" stroke="#FFFFFF" strokeWidth="3" />
            <circle cx={PICKUP.x} cy={PICKUP.y} r="3.5" fill="#FFFFFF" />

            {/* Car */}
            <g transform={`translate(${CAR.x} ${CAR.y})`}>
              <circle r="17" fill="#FFFFFF" stroke="#111111" strokeWidth="2" />
              <path
                d="M-9 4 v-4 l3 -6 c.5 -1 1.4 -1.5 2.4 -1.5 h7.2 c1 0 1.9.5 2.4 1.5 l3 6 v4 c0 .8 -.6 1.4 -1.4 1.4 h-1 a2.3 2.3 0 0 1 -4.6 0 h-4 a2.3 2.3 0 0 1 -4.6 0 h-1 c-.8 0 -1.4 -.6 -1.4 -1.4z"
                fill="#111111"
              />
            </g>

            {/* Drop pin */}
            <g transform={`translate(${DROP.x} ${DROP.y})`}>
              <ellipse cx="0" cy="2" rx="9" ry="3.5" fill="#000000" opacity="0.2" />
              <path d="M0 0 C-12 -16 -16 -23 -16 -30 a16 16 0 1 1 32 0 c0 7 -4 14 -16 30z" fill="#111111" />
              <circle cx="0" cy="-30" r="6" fill="#FFFFFF" />
            </g>
          </svg>
        )}
      </div>

      {/* Labels */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2 sm:left-6 sm:top-6">
        <span className="inline-flex max-w-60 items-center gap-2 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-[#111111] shadow-[0_6px_20px_rgba(0,0,0,0.1)]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-[#111111] ring-2 ring-[#111111]/15" />
          <span className="truncate">{pickup.trim() || "Pickup"}</span>
        </span>
        <span className="inline-flex max-w-60 items-center gap-2 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-[#111111] shadow-[0_6px_20px_rgba(0,0,0,0.1)]">
          <span className="h-2 w-2 shrink-0 rounded-full border-2 border-[#111111] bg-white" />
          <span className="truncate">{destination.trim() || "Destination"}</span>
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111111] px-4 py-2 text-xs font-semibold text-white shadow-lg">
        {hasRoute ? "12.4 km · Fastest route" : "Enter pickup and destination"}
      </div>

      {/* Controls */}
      <div className="absolute right-4 top-4 flex flex-col overflow-hidden rounded-md bg-white shadow-[0_6px_20px_rgba(0,0,0,0.1)] sm:right-6 sm:top-6">
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom >= MAX_ZOOM}
          onClick={() => setZoom((z) => Math.min(MAX_ZOOM, +(z + 0.25).toFixed(2)))}
          className="flex h-10 w-10 items-center justify-center text-[#111111] hover:bg-[#F4F4F4] disabled:opacity-30"
        >
          <Plus size={17} />
        </button>
        <div className="mx-2 h-px bg-[#EFEFEF]" />
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom <= MIN_ZOOM}
          onClick={() => setZoom((z) => Math.max(MIN_ZOOM, +(z - 0.25).toFixed(2)))}
          className="flex h-10 w-10 items-center justify-center text-[#111111] hover:bg-[#F4F4F4] disabled:opacity-30"
        >
          <Minus size={17} />
        </button>
      </div>
      <button
        type="button"
        aria-label="Reset map view"
        onClick={() => setZoom(1)}
        className="absolute bottom-6 right-4 flex h-10 w-10 items-center justify-center rounded-md bg-white text-[#111111] shadow-[0_6px_20px_rgba(0,0,0,0.1)] hover:bg-[#F4F4F4] sm:right-6"
      >
        <LocateFixed size={18} />
      </button>
    </div>
  );
}
