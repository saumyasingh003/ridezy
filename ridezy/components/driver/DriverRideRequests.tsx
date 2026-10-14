"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Compass, Navigation, Power } from "lucide-react";
import RideOfferCard from "./RideOfferCard";
import { api, type RideView } from "@/lib/rideApi";
import { getCurrentPosition } from "@/lib/geocode";

// Same cadence as the Live Rides page: offers every 5 s, location every 20 s
// (the backend treats a location older than 60 s as stale and skips the driver).
const RIDE_POLL_MS = 5_000;
const LOCATION_PUSH_MS = 20_000;

type Availability = "AVAILABLE" | "OFFLINE" | "BUSY";

/**
 * Driver dashboard: incoming ride requests. Accepting hands over to
 * /driver/live-rides, which runs the trip (arrive → OTP start → complete).
 */
export default function DriverRideRequests({ compact = false }: { compact?: boolean } = {}) {
  const router = useRouter();
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [offers, setOffers] = useState<RideView[]>([]);
  const [currentRide, setCurrentRide] = useState<RideView | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null);
  const [error, setError] = useState("");

  // GET /api/drivers/location → online status (404 = never shared = offline).
  useEffect(() => {
    api<{ availabilityStatus: Availability }>("/drivers/location").then(({ ok, data }) =>
      setAvailability(ok && data ? data.availabilityStatus : "OFFLINE")
    );
  }, []);

  // BUSY: show the ride in progress.
  useEffect(() => {
    if (availability !== "BUSY") return;
    api<RideView>("/rides/current").then(({ ok, data }) => setCurrentRide(ok ? data : null));
  }, [availability]);

  // AVAILABLE: poll offers.
  useEffect(() => {
    if (availability !== "AVAILABLE") return;
    const load = () =>
      api<RideView[]>("/drivers/rides/requests").then(({ ok, status, message, data }) => {
        if (ok && Array.isArray(data)) {
          setOffers(data);
          setError("");
        } else {
          setError(
            status === 403
              ? "This tab is no longer signed in as a driver. Log in again."
              : message || "Couldn't load ride requests."
          );
        }
      });
    load();
    const id = setInterval(load, RIDE_POLL_MS);
    return () => clearInterval(id);
  }, [availability]);

  // Online (AVAILABLE or BUSY): keep the location fresh so matching keeps finding
  // this driver, and the passenger can track them during a ride.
  const locationFailed = useRef(false);
  useEffect(() => {
    if (availability !== "AVAILABLE" && availability !== "BUSY") return;
    const push = async () => {
      try {
        const coords = await getCurrentPosition();
        const { ok, message } = await api("/drivers/location", { method: "PATCH", body: JSON.stringify(coords) });
        if (!ok) throw new Error(message);
        locationFailed.current = false;
      } catch (err) {
        if (!locationFailed.current) setError((err as Error).message || "Couldn't update your location.");
        locationFailed.current = true;
      }
    };
    push();
    const id = setInterval(push, LOCATION_PUSH_MS);
    return () => clearInterval(id);
  }, [availability]);

  const handleAccept = useCallback(
    async (offer: RideView) => {
      setActingOn(offer.id);
      const { ok, message } = await api<RideView>(`/rides/${offer.id}/accept`, { method: "POST" });
      setActingOn(null);
      if (ok) {
        router.push("/driver/live-rides"); // trip continues there
      } else {
        setOffers((prev) => prev.filter((o) => o.id !== offer.id));
        setError(message);
      }
    },
    [router]
  );

  const handleDecline = useCallback(async (offer: RideView) => {
    setActingOn(offer.id);
    const { ok, message } = await api(`/rides/${offer.id}/reject`, { method: "POST" });
    setActingOn(null);
    setOffers((prev) => prev.filter((o) => o.id !== offer.id));
    if (!ok) setError(message);
  }, []);

  if (availability === null) return null;

  const visibleOffers = availability === "AVAILABLE" ? offers : [];

  // Compact (inside the dashboard trips card): only offers, the active ride and errors.
  if (compact) {
    if (!error && availability !== "BUSY" && visibleOffers.length === 0) return null;
    return (
      <section aria-label="Ride requests" className="mb-5 space-y-3">
        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </p>
        )}
        {availability === "BUSY" ? (
          <Link
            href="/driver/live-rides"
            className="group flex items-center gap-3 rounded-xl bg-black p-4 text-white"
          >
            <Navigation className="w-5 h-5 shrink-0" />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold">You&apos;re on a ride</span>
              <span className="block truncate text-xs text-white/70">
                {currentRide
                  ? `${currentRide.passenger?.name || "Passenger"} · ${currentRide.pickup.address} → ${currentRide.destination.address}`
                  : "Open Live Rides to continue the trip."}
              </span>
            </span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        ) : (
          visibleOffers.map((offer) => (
            <RideOfferCard
              key={offer.id}
              offer={offer}
              compact
              busy={actingOn === offer.id}
              disabled={actingOn !== null}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))
        )}
      </section>
    );
  }

  return (
    <section aria-label="Ride requests" className="space-y-4">
      {error && (
        <p role="alert" className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-medium text-rose-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </p>
      )}

      {availability === "BUSY" ? (
        <Link
          href="/driver/live-rides"
          className="group flex items-center gap-4 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-black p-5 sm:p-6 text-white shadow-xs"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <Navigation className="w-5 h-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-caslon text-xl font-bold">You&apos;re on a ride</span>
            <span className="block truncate text-xs text-white/70">
              {currentRide
                ? `${currentRide.passenger?.name || "Passenger"} · ${currentRide.pickup.address} → ${currentRide.destination.address}`
                : "Open Live Rides to continue the trip."}
            </span>
          </span>
          <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : availability === "OFFLINE" ? (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-5 sm:p-6 shadow-xs">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
            <Power className="w-5 h-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-caslon text-xl font-bold text-black">You are offline</p>
            <p className="text-xs text-stone-500">Go online to start receiving ride requests nearby.</p>
          </div>
          <Link
            href="/driver/live-rides"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Power className="w-4 h-4" />
            Go Online
          </Link>
        </div>
      ) : visibleOffers.length > 0 ? (
        visibleOffers.map((offer) => (
          <RideOfferCard
            key={offer.id}
            offer={offer}
            busy={actingOn === offer.id}
            disabled={actingOn !== null}
            onAccept={handleAccept}
            onDecline={handleDecline}
          />
        ))
      ) : (
        <div className="flex items-center gap-4 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-5 sm:p-6 shadow-xs">
          <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200">
            <span className="absolute inset-0 rounded-2xl border-2 border-emerald-400/50 animate-ping" />
            <Compass className="w-6 h-6 text-black" />
          </span>
          <div>
            <p className="font-caslon text-xl font-bold text-black">Waiting for ride requests</p>
            <p className="text-xs text-stone-500">You&apos;re online. New requests appear here automatically.</p>
          </div>
        </div>
      )}
    </section>
  );
}
