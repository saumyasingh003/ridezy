"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import BookRidePanel from "./BookRidePanel";
import RouteMap from "./RouteMap";
import YourRidePanel from "./YourRidePanel";
import { rideOptions } from "./data";
import { currentRideHref, saveCurrentRide } from "./currentRide";

/**
 * Holds the shared booking state and lays out the three dashboard panels:
 * Book a Ride (left), Map (center), Your Ride (right).
 * The top nav lives in app/(dashboard)/layout.tsx.
 */
export default function RideBooker() {
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [rideId, setRideId] = useState("standard");
  const [booked, setBooked] = useState(false);
  const router = useRouter();

  const ride = rideOptions.find((r) => r.id === rideId) ?? rideOptions[2];
  const canBook = pickup.trim() !== "" && destination.trim() !== "";

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
      {/* LEFT — Book a Ride */}
      <BookRidePanel
        pickup={pickup}
        destination={destination}
        onPickupChange={(value) => {
          setPickup(value);
          setBooked(false);
        }}
        onDestinationChange={(value) => {
          setDestination(value);
          setBooked(false);
        }}
        onSwap={() => {
          setPickup(destination);
          setDestination(pickup);
          setBooked(false);
        }}
      />

      {/* CENTER — Map */}
      <section aria-label="Route map" className="order-2 h-[360px] sm:h-[440px] lg:h-auto">
        <RouteMap pickup={pickup} destination={destination} />
      </section>

      {/* RIGHT — Your Ride */}
      <YourRidePanel
        ride={ride}
        booked={booked}
        canBook={canBook}
        onSelectRide={(id) => {
          setRideId(id);
          setBooked(false);
        }}
        onBook={() => {
          const booking = { pickup: pickup.trim(), destination: destination.trim(), ride: rideId };
          saveCurrentRide(booking);
          setBooked(true);
          router.push(currentRideHref(booking));
        }}
      />
    </div>
  );
}
