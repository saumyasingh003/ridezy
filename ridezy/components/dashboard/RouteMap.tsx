"use client";

import { useMemo } from "react";
import RideMap from "@/components/map/RideMap";
import { decodePolyline } from "@/lib/mapGeo";
import { formatDuration, formatKm, type Place, type RideEstimate } from "@/lib/rideApi";

/** Booking map: real streets (OpenFreeMap), the picked places and the route the fare is based on. */
export default function RouteMap({
  pickup,
  destination,
  pickupPlace,
  destinationPlace,
  hasRoute,
  estimate,
  loading,
}: {
  pickup: string;
  destination: string;
  /** Picked places (with coordinates), or null while not chosen. */
  pickupPlace: Place | null;
  destinationPlace: Place | null;
  /** Both places picked (with coordinates). */
  hasRoute: boolean;
  estimate: RideEstimate | null;
  loading: boolean;
}) {
  // The road route from the fare estimate; a straight line if routing was unavailable.
  const geometry = estimate?.routeGeometry ?? null;
  const route = useMemo(() => {
    if (!pickupPlace || !destinationPlace) return null;
    if (geometry) return decodePolyline(geometry);
    return [pickupPlace, destinationPlace];
  }, [pickupPlace, destinationPlace, geometry]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#F2F0EB]">
      <RideMap
        className="h-full w-full"
        pickup={pickupPlace}
        destination={destinationPlace}
        route={route}
        fitKey={`${pickupPlace?.latitude},${pickupPlace?.longitude}|${destinationPlace?.latitude},${destinationPlace?.longitude}|${route?.length ?? 0}`}
      />

      {/* Labels */}
      <div className="pointer-events-none absolute left-4 top-4 flex flex-col gap-2 sm:left-6 sm:top-6">
        <span className="inline-flex max-w-60 items-center gap-2 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-[#111111] shadow-[0_6px_20px_rgba(0,0,0,0.1)]">
          <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25" />
          <span className="truncate">{pickup.trim() || "Pickup"}</span>
        </span>
        <span className="inline-flex max-w-60 items-center gap-2 rounded-md bg-white px-3.5 py-2 text-xs font-semibold text-[#111111] shadow-[0_6px_20px_rgba(0,0,0,0.1)]">
          <span className="h-2.5 w-2.5 shrink-0 bg-[#111111] ring-2 ring-[#111111]/15" />
          <span className="truncate">{destination.trim() || "Destination"}</span>
        </span>
      </div>

      <div className="pointer-events-none absolute bottom-11 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-[#111111] px-4 py-2 text-xs font-semibold text-white shadow-lg">
        {!hasRoute
          ? "Enter pickup and destination"
          : loading
          ? "Calculating route…"
          : estimate
          ? `${formatKm(estimate.distanceKm)} · ${formatDuration(estimate.durationMinutes)}`
          : "Route unavailable"}
      </div>
    </div>
  );
}
