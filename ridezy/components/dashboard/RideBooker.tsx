"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BookRidePanel from "./BookRidePanel";
import RouteMap from "./RouteMap";
import YourRidePanel from "./YourRidePanel";
import { rideOptions } from "./data";
import { CURRENT_RIDE_HREF, saveLastRideId } from "./currentRide";
import {
  api,
  type NearbyAvailability,
  type Place,
  type RideEstimate,
  type RideView,
  type VehicleType,
} from "@/lib/rideApi";

const AVAILABILITY_REFRESH_MS = 20_000;

export type EstimateState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; byType: Partial<Record<VehicleType, RideEstimate>> }
  | { status: "error"; message: string };

/**
 * Holds the shared booking state and lays out the three dashboard panels:
 * Book a Ride (left), Map (center), Your Ride (right).
 * The top nav lives in app/(dashboard)/layout.tsx.
 *
 * Flow: pick pickup + destination (with coordinates) → POST /api/rides/estimate
 * per vehicle type → POST /api/rides → /dashboard/current-ride.
 */
export default function RideBooker() {
  const router = useRouter();

  const [pickupText, setPickupText] = useState("");
  const [pickup, setPickup] = useState<Place | null>(null);
  const [destinationText, setDestinationText] = useState("");
  const [destination, setDestination] = useState<Place | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("CAB");

  // Last finished quote, tagged with the route it belongs to. "idle" and
  // "loading" are derived below instead of being set inside the effect.
  const [quote, setQuote] = useState<{ key: string; result: EstimateState } | null>(null);
  const [booking, setBooking] = useState(false);
  const [bookError, setBookError] = useState("");
  const [activeRide, setActiveRide] = useState<RideView | null>(null);

  // An active ride blocks a new booking (backend: one active ride per passenger).
  useEffect(() => {
    api<RideView>("/rides/current").then(({ ok, data }) => setActiveRide(ok ? data : null));
  }, []);

  // Fresh quotes whenever the route changes. Same distance for every type, but
  // the fare rules live on the server, so each type is asked for separately.
  const routeKey =
    pickup && destination
      ? `${pickup.latitude},${pickup.longitude}|${destination.latitude},${destination.longitude}`
      : null;
  const estimates: EstimateState = !routeKey
    ? { status: "idle" }
    : quote?.key === routeKey
    ? quote.result
    : { status: "loading" };

  useEffect(() => {
    if (!routeKey || !pickup || !destination) return;
    let cancelled = false;

    Promise.all(
      rideOptions.map((option) =>
        api<RideEstimate>("/rides/estimate", {
          method: "POST",
          body: JSON.stringify({ pickup, destination, vehicleType: option.id }),
        })
      )
    ).then((results) => {
      if (cancelled) return;
      const failed = results.find((r) => !r.ok);
      if (failed) {
        setQuote({ key: routeKey, result: { status: "error", message: failed.message } });
        return;
      }
      const byType: Partial<Record<VehicleType, RideEstimate>> = {};
      results.forEach((r) => {
        if (r.data) byType[r.data.vehicleType] = r.data;
      });
      setQuote({ key: routeKey, result: { status: "ready", byType } });
    });

    return () => {
      cancelled = true;
    };
    // routeKey captures pickup/destination coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeKey]);

  // Drivers near the pickup, per vehicle type (same filter as matching).
  const [nearby, setNearby] = useState<{ key: string; data: NearbyAvailability } | null>(null);
  const pickupKey = pickup ? `${pickup.latitude},${pickup.longitude}` : null;
  useEffect(() => {
    if (!pickupKey || !pickup) return;
    const load = () =>
      api<NearbyAvailability>(
        `/rides/nearby-drivers?latitude=${pickup.latitude}&longitude=${pickup.longitude}`
      ).then(({ ok, data }) => {
        if (ok && data) setNearby({ key: pickupKey, data });
      });
    load();
    const id = setInterval(load, AVAILABILITY_REFRESH_MS);
    return () => clearInterval(id);
    // pickupKey captures the pickup coordinates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pickupKey]);
  const availability = nearby && nearby.key === pickupKey ? nearby.data : null;

  const selectedEstimate = estimates.status === "ready" ? estimates.byType[vehicleType] ?? null : null;

  const handleBook = async () => {
    if (!pickup || !destination || booking) return;
    setBooking(true);
    setBookError("");
    const { ok, status, message, data } = await api<RideView & { driversContacted: number }>("/rides", {
      method: "POST",
      body: JSON.stringify({ pickup, destination, vehicleType }),
    });
    setBooking(false);

    if (ok && data) {
      saveLastRideId(data.id);
      router.push(CURRENT_RIDE_HREF);
      return;
    }
    if (status === 409) {
      // Already has an active ride: send them to it.
      const current = await api<RideView>("/rides/current");
      if (current.ok) setActiveRide(current.data);
    }
    setBookError(message);
  };

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* LEFT — Book a Ride */}
      <BookRidePanel
        pickup={pickupText}
        destination={destinationText}
        pickupResolved={pickup !== null}
        destinationResolved={destination !== null}
        onPickupChange={(value) => {
          setPickupText(value);
          setPickup(null);
        }}
        onDestinationChange={(value) => {
          setDestinationText(value);
          setDestination(null);
        }}
        onPickupSelect={(place) => {
          setPickupText(place.address);
          setPickup(place);
          setBookError("");
        }}
        onDestinationSelect={(place) => {
          setDestinationText(place.address);
          setDestination(place);
          setBookError("");
        }}
        onSwap={() => {
          setPickupText(destinationText);
          setDestinationText(pickupText);
          setPickup(destination);
          setDestination(pickup);
        }}
        hasActiveRide={activeRide !== null}
      />

      {/* CENTER — Map */}
      <section aria-label="Route map" className="order-2 h-[360px] sm:h-[440px] lg:h-auto">
        <RouteMap
          pickup={pickupText}
          destination={destinationText}
          pickupPlace={pickup}
          destinationPlace={destination}
          hasRoute={pickup !== null && destination !== null}
          estimate={selectedEstimate}
          loading={estimates.status === "loading"}
        />
      </section>

      {/* RIGHT — Your Ride */}
      <YourRidePanel
        vehicleType={vehicleType}
        estimates={estimates}
        canBook={
          // Not blocked when nobody is nearby (for now): the search keeps running and the
          // passenger can "Search again" once drivers come online.
          pickup !== null && destination !== null && selectedEstimate !== null && !activeRide
        }
        availability={availability}
        booking={booking}
        bookError={bookError}
        activeRide={activeRide}
        onSelectRide={setVehicleType}
        onBook={handleBook}
        onViewActiveRide={() => router.push(CURRENT_RIDE_HREF)}
      />
    </div>
  );
}
