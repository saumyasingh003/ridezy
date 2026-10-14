"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock,
  Loader2,
  MapPin,
  Navigation,
  Radar,
  RefreshCw,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { rideOptionFor } from "./data";
import RideProgress, { stepForStatus } from "./RideProgress";
import RidePayment from "./RidePayment";
import RateRide, { Stars } from "@/components/ratings/RateRide";
import RideChat from "@/components/chat/RideChat";
import RideTipPicker from "./RideTipPicker";
import RideMap from "@/components/map/RideMap";
import { getSocket } from "@/lib/socket";
import { useTripRoutes } from "@/lib/useTripRoutes";
import { clearLastRideId, loadLastRideId, saveLastRideId } from "./currentRide";
import {
  api,
  CANCELLABLE_STATUSES,
  formatDuration,
  formatKm,
  mapPinUrl,
  type AssignedDriverView,
  type RideStatus,
  type RideView,
} from "@/lib/rideApi";

// Until Socket.IO (Step 5) pushes updates, the page re-reads the ride. Reading
// it also lets the backend run its lazy search maintenance (re-offer to more
// drivers every 15 s, cancel after RIDE_SEARCH_TIMEOUT_SECONDS).
const POLL_MS = 5_000;

const eyebrow = "text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]";
const card = "rounded-md border border-[#E8E8E8] bg-white p-5 sm:p-6";

/** Card title: one Caslon heading (no eyebrow label or underline bar). */
function CardHeader({ title }: { title: string }) {
  return <h2 className="font-caslon text-2xl font-bold leading-none tracking-tight text-[#111111]">{title}</h2>;
}

function isActive(status: RideStatus) {
  return status !== "RIDE_COMPLETED" && status !== "CANCELLED";
}

function minutesSince(iso: string) {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
}

type LoadResult = { kind: "ride"; ride: RideView | null } | { kind: "error"; message: string };

/**
 * GET /api/rides/current gives the active ride. When there is none (404) we
 * look up the last booked ride by id to show how it ended (completed,
 * cancelled, or timed out by the system).
 */
async function loadRide(): Promise<LoadResult> {
  const current = await api<RideView>("/rides/current");
  if (current.ok && current.data) {
    saveLastRideId(current.data.id);
    return { kind: "ride", ride: current.data };
  }
  if (current.status !== 404) return { kind: "error", message: current.message };

  const lastId = loadLastRideId();
  if (!lastId) return { kind: "ride", ride: null };
  const last = await api<RideView>(`/rides/${lastId}`);
  if (!last.ok) clearLastRideId();
  return { kind: "ride", ride: last.ok ? last.data : null };
}

export default function CurrentRideView() {
  const [ride, setRide] = useState<RideView | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  // GET /api/rides/:id/driver (live location), tagged with the ride it belongs to.
  const [tracking, setTracking] = useState<{ rideId: string; data: AssignedDriverView } | null>(null);
  // POST /api/rides/:id/match ("Search again")
  const [searchingAgain, setSearchingAgain] = useState(false);
  const [searchNote, setSearchNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [, forceTick] = useState(0);

  const applyLoad = useCallback((result: LoadResult) => {
    if (result.kind === "error") {
      setLoadError(result.message);
    } else {
      setRide(result.ride);
      setLoadError("");
    }
    setLoading(false);
  }, []);

  const refresh = useCallback(() => loadRide().then(applyLoad), [applyLoad]);

  useEffect(() => {
    loadRide().then(applyLoad);
  }, [applyLoad]);

  // Poll while the ride is in progress, and after it while a cash payment
  // waits for the driver to confirm it.
  const awaitingCash = ride?.status === "RIDE_COMPLETED" && ride.payment?.status === "PENDING";
  const polling = ride !== null && (isActive(ride.status) || awaitingCash);
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(() => {
      refresh();
      forceTick((n) => n + 1); // keeps "searching for N min" current
    }, POLL_MS);
    return () => clearInterval(id);
  }, [polling, refresh]);

  // Live driver location while a driver is assigned and the ride is active.
  const trackRideId = ride && ride.driver && isActive(ride.status) && ride.status !== "SEARCHING" ? ride.id : null;
  useEffect(() => {
    if (!trackRideId) return;
    const load = () =>
      api<AssignedDriverView>(`/rides/${trackRideId}/driver`).then(({ ok, data }) => {
        if (ok && data) setTracking({ rideId: trackRideId, data });
      });
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [trackRideId]);
  // Instant updates: the backend pushes each new driver position over Socket.IO
  // (the poll above stays as the fallback, e.g. after a reconnect).
  useEffect(() => {
    if (!trackRideId) return;
    const socket = getSocket();
    if (!socket) return;
    const onLocation = ({ rideId, ...location }: NonNullable<AssignedDriverView["location"]> & { rideId: string }) => {
      if (rideId !== trackRideId) return;
      setTracking((t) =>
        t && t.rideId === trackRideId
          ? { rideId: trackRideId, data: { ...t.data, location: { ...location, isLocationStale: false } } }
          : t,
      );
    };
    socket.on("ride:driver-location", onLocation);
    return () => {
      socket.off("ride:driver-location", onLocation);
    };
  }, [trackRideId]);
  const live = tracking && tracking.rideId === trackRideId ? tracking.data.location : null;

  // Map: trip route, plus the driver's route to the pickup (or destination once started).
  const liveLat = live?.latitude;
  const liveLng = live?.longitude;
  const driverPoint = useMemo(
    () => (liveLat !== undefined && liveLng !== undefined ? { latitude: liveLat, longitude: liveLng } : null),
    [liveLat, liveLng],
  );
  const driverTarget = ride && driverPoint ? (ride.status === "RIDE_STARTED" ? ride.destination : ride.pickup) : null;
  const { route: tripRoute, driverRoute } = useTripRoutes(ride?.pickup, ride?.destination, driverPoint, driverTarget);

  const handleSearchAgain = async () => {
    if (!ride) return;
    setSearchingAgain(true);
    const { ok, message, data } = await api<RideView & { newlyContacted: number }>(`/rides/${ride.id}/match`, {
      method: "POST",
    });
    setSearchingAgain(false);
    setSearchNote({ ok: ok && (data?.newlyContacted ?? 0) > 0, text: message });
    if (ok && data) setRide(data);
    else refresh(); // e.g. a driver accepted in the meantime
  };

  const handleCancel = async () => {
    if (!ride) return;
    setCancelling(true);
    setCancelError("");
    const { ok, message, data } = await api<RideView>(`/rides/${ride.id}/cancel`, {
      method: "PATCH",
      body: JSON.stringify({ reason: "Cancelled by passenger" }),
    });
    setCancelling(false);
    if (ok && data) {
      setRide(data);
      setConfirmCancel(false);
    } else {
      setCancelError(message);
      refresh(); // status may have moved on (e.g. the ride started)
    }
  };

  /* ---------- Loading ---------- */
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 px-4 py-24 text-sm text-[#7A7A7A]">
        <Loader2 size={16} className="animate-spin" /> Loading your ride…
      </div>
    );
  }

  /* ---------- No ride / finished ride ---------- */
  if (!ride || !isActive(ride.status)) {
    const cancelled = ride?.status === "CANCELLED";
    const completed = ride?.status === "RIDE_COMPLETED";
    const title = cancelled
      ? ride?.cancelledBy === "SYSTEM"
        ? "No driver found"
        : "Ride cancelled"
      : completed
        ? "Trip complete"
        : "No active ride";
    const text = cancelled
      ? ride?.cancelledBy === "SYSTEM"
        ? ride.cancellationReason || "No driver accepted your ride in time. Please try booking again."
        : "Your ride was cancelled. You haven't been charged."
      : completed
        ? `You've arrived at ${ride?.destination.address}.`
        : loadError || "Book a ride from the dashboard and it will show up here.";

    if (completed && ride) {
      return (
        <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-8 pb-16 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
            {/* LEFT SIDE: Payment Banner / UI Visual */}
            <div className="lg:col-span-5 w-full flex flex-col">
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white shadow-xs w-full h-full min-h-[520px] sm:min-h-[560px] lg:min-h-[600px]">
                <Image
                  src="/payment-banner.webp"
                  alt="Payment visual"
                  fill
                  priority
                  sizes="(max-width: 1024px) 100vw, 42vw"
                  className="object-cover object-center"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 pointer-events-none" />

                <div className="absolute bottom-6 left-6 right-6 z-10 text-white">
                  <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">Ridezy Express Billing</p>
                  <p className="text-base font-bold drop-shadow-sm mt-0.5">UPI, Debit/Credit Cards &amp; Driver Cash</p>
                </div>
              </div>
            </div>

            {/* RIGHT SIDE: Trip complete & Payment */}
            <div className="lg:col-span-7 w-full flex flex-col">
              <div className="p-6 sm:p-8 lg:p-9 pb-8 sm:pb-10 rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs flex flex-col justify-between w-full h-full min-h-[520px] sm:min-h-[560px] lg:min-h-[600px] space-y-6">
                <div>
                  <h1 className="font-caslon text-3xl sm:text-4xl font-bold tracking-tight text-[#111111]">
                    {title}
                  </h1>
                  <p className="mt-1.5 text-sm text-[#7A7A7A] leading-relaxed">{text}</p>
                </div>

                {/* Payment (POST /api/rides/:rideId/payment) */}
                <div className="w-full flex-1 flex flex-col justify-center">
                  <RidePayment
                    ride={ride}
                    onPaymentChange={(payment) => setRide((r) => (r ? { ...r, payment } : r))}
                  />
                </div>

                {/* Rating (POST /api/rides/:rideId/rating): unlocked once paid */}
                {ride.driver && ride.payment?.status === "COMPLETED" && (
                  <div className="w-full">
                    {ride.myRating ? (
                      <p className="flex items-center justify-center gap-2 rounded-md bg-[#F4F4F4] px-4 py-3 text-sm text-[#111111]">
                        You rated {ride.driver.name} <Stars score={ride.myRating} />
                      </p>
                    ) : (
                      <RateRide
                        rideId={ride.id}
                        subject={`${ride.driver.name}, your driver`}
                        onRated={(rating) => setRide((r) => (r ? { ...r, myRating: rating.score } : r))}
                      />
                    )}
                  </div>
                )}

                {/* Chat is closed now; the history stays readable */}
                {ride.driver && (
                  <RideChat rideId={ride.id} rideStatus={ride.status} label="View chat history" />
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center px-4 py-20 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-md bg-[#F4F4F4] text-[#111111]">
          {cancelled ? <X size={24} /> : <ArrowRight size={24} />}
        </span>
        <h1 className="mt-5 font-caslon text-3xl font-bold tracking-tight text-[#111111]">{title}</h1>
        <p className="mt-2 text-sm text-[#7A7A7A]">{text}</p>
        <Link
          href="/dashboard"
          onClick={() => clearLastRideId()}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#111111] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-black"
        >
          {ride ? "Book another ride" : "Book a ride"}
          <ArrowRight size={15} />
        </Link>
      </div>
    );
  }

  /* ---------- Active ride ---------- */
  const option = rideOptionFor(ride.vehicleType);
  const RideIcon = option.icon;
  const searching = ride.status === "SEARCHING";
  const canCancel = CANCELLABLE_STATUSES.includes(ride.status);
  const searchMinutes = minutesSince(ride.createdAt);
  const driver = ride.driver;
  const vehicle = driver?.vehicle;
  const initials = (driver?.name || "D")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 pb-12 space-y-6">
        {/* BANNER — Customer banner style */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[195px] sm:h-[220px] lg:h-[240px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/customer-banner2.webp"
              alt="Current ride banner"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "center 15%" }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/30 to-transparent pointer-events-none" />
          </div>

          <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 flex flex-col justify-center">
            <div className="max-w-2xl">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/80">
                Trip Tracker &bull; Ridezy Passenger
              </span>
              <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight mt-1">
                Your Current Ride
              </h1>
              <p className="text-xs sm:text-sm text-white/90 mt-1 sm:mt-1.5 font-medium leading-relaxed drop-shadow-xs">
                Real-time status, driver details, OTP verification, and live fare updates.
              </p>
            </div>
          </div>
        </div>

        {/* Progress (compact: less vertical padding than the other cards) */}
        <div className="rounded-md border border-[#E8E8E8] bg-white px-5 py-4 sm:px-6">
          <RideProgress
            current={stepForStatus(ride.status)}
            note={
              searching
                ? searchMinutes < 1
                  ? "Searching just now"
                  : `Searching for ${searchMinutes} min`
                : ride.assignedAt
                  ? `Driver assigned at ${new Date(ride.assignedAt).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}`
                  : undefined
            }
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* ================= LEFT: Ride details ================= */}
          <div className="space-y-6">
            {/* Driver / searching */}
            {searching || !driver ? (
              <section className={card}>
                <CardHeader title="Finding Your Driver" />
                <div className="mt-6 flex items-center gap-5">
                  {/* Radar: sonar rings + rotating sweep */}
                  <span className="relative flex h-16 w-16 shrink-0 items-center justify-center">
                    <span aria-hidden="true" className="ridezy-sonar absolute inset-0 rounded-full bg-[#111111]/25" />
                    <span
                      aria-hidden="true"
                      className="ridezy-sonar absolute inset-0 rounded-full bg-[#111111]/25"
                      style={{ animationDelay: "0.8s" }}
                    />
                    <span
                      aria-hidden="true"
                      className="ridezy-sonar absolute inset-0 rounded-full bg-[#111111]/25"
                      style={{ animationDelay: "1.6s" }}
                    />
                    <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#111111] text-white">
                      <span
                        aria-hidden="true"
                        className="ridezy-sweep absolute inset-0"
                        style={{ background: "conic-gradient(from 0deg, rgba(255,255,255,0.35), transparent 30%)" }}
                      />
                      <Radar size={22} className="relative" />
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-base font-bold text-[#111111]">
                      Contacting nearby {option.name.toLowerCase()} drivers
                      <span aria-hidden="true" className="inline-flex gap-0.5 pl-0.5">
                        {[0, 1, 2].map((i) => (
                          <span
                            key={i}
                            className="ridezy-dot inline-block h-1 w-1 rounded-full bg-[#111111]"
                            style={{ animationDelay: `${i * 0.15}s` }}
                          />
                        ))}
                      </span>
                    </p>
                    <p className="text-xs text-[#7A7A7A]">
                      We offer your ride to the closest available drivers and widen the search every few
                      seconds. This page updates automatically.
                    </p>
                  </div>
                </div>

                {/* Indeterminate progress */}
                <div aria-hidden="true" className="relative mt-5 h-1 overflow-hidden rounded-full bg-[#EFEFEF]">
                  <span className="ridezy-indeterminate absolute inset-y-0 rounded-full bg-[#111111]" />
                </div>

                <div className="mt-4 flex flex-col gap-3 border-t border-dashed border-[#E2E2E2] pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p
                    role="status"
                    className={`text-xs ${searchNote ? (searchNote.ok ? "font-medium text-[#111111]" : "text-[#7A7A7A]") : "text-[#7A7A7A]"
                      }`}
                  >
                    {searchNote?.text || "No luck yet? Search again to reach drivers who just came online."}
                  </p>
                  <button
                    type="button"
                    onClick={handleSearchAgain}
                    disabled={searchingAgain}
                    className="group inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-[#111111] px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#111111] hover:text-white active:scale-[0.98] disabled:opacity-60"
                  >
                    <RefreshCw
                      size={14}
                      className={`transition-transform duration-500 ${searchingAgain ? "animate-spin" : "group-hover:rotate-180"
                        }`}
                    />
                    {searchingAgain ? "Searching…" : "Search again"}
                  </button>
                </div>

                {/* Optional tip offered while searching (shown to drivers with the request) */}
                <RideTipPicker ride={ride} onChange={setRide} />
              </section>
            ) : (
              <section className={card}>
                <div className="flex items-start justify-between gap-3">
                  <CardHeader title="Driver Information" />
                </div>

                <div className="mt-4 flex items-center gap-4">
                  {driver.profileImage ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={driver.profileImage}
                      alt={driver.name}
                      className="h-14 w-14 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#111111] text-lg font-bold text-white">
                      {initials}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-bold text-[#111111]">{driver.name}</p>
                    <p className="text-xs text-[#7A7A7A]">
                      {driver.rating
                        ? `★ ${driver.rating.toFixed(1)} · ${driver.ratingCount ?? 0} ${driver.ratingCount === 1 ? "rating" : "ratings"
                        }`
                        : "New driver · not rated yet"}
                    </p>
                  </div>
                  {/* Chat + call: open from acceptance until the ride ends */}
                  <RideChat rideId={ride.id} rideStatus={ride.status} variant="icons" />
                </div>

                {/* Live tracking (GET /api/rides/:id/driver) */}
                {live && (
                  <div className="mt-5 flex flex-col gap-3 rounded-md border border-[#111111] px-4 py-3 sm:flex-row sm:items-center">
                    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-[#111111] text-white">
                      <Navigation size={17} />
                      {!live.isLocationStale && (
                        <span className="absolute -right-1 -top-1 flex h-2.5 w-2.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                        </span>
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-[#111111]">
                        {ride.status === "DRIVER_ARRIVED"
                          ? "Your driver is at the pickup point"
                          : `${formatKm(live.distanceKm)} away · ~${live.etaMinutes} min ${live.heading === "PICKUP" ? "to pickup" : "to destination"
                          }`}
                      </p>
                      <p className="text-xs text-[#7A7A7A]">
                        {live.isLocationStale
                          ? "Location not updated recently"
                          : `Live location · updated ${live.lastLocationUpdatedAt
                            ? new Date(live.lastLocationUpdatedAt).toLocaleTimeString("en-IN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })
                            : "just now"
                          }`}
                      </p>
                    </div>
                    <a
                      href={mapPinUrl(live.latitude, live.longitude)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md bg-[#111111] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-black"
                    >
                      <MapPin size={13} />
                      View on map
                    </a>
                  </div>
                )}

                <div className={`mt-5 grid grid-cols-1 gap-3 ${ride.startOtp ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
                  <div className="rounded-md bg-[#F4F4F4] px-4 py-3">
                    <p className={eyebrow}>Vehicle</p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[#111111]">
                      <RideIcon size={14} />
                      {vehicle ? `${vehicle.make} ${vehicle.model}` : option.name}
                    </p>
                    {vehicle?.color && <p className="text-xs capitalize text-[#7A7A7A]">{vehicle.color}</p>}
                  </div>
                  <div className="rounded-md bg-[#F4F4F4] px-4 py-3">
                    <p className={eyebrow}>Number plate</p>
                    <p className="mt-1 font-mono text-sm font-bold uppercase tracking-wider text-[#111111]">
                      {vehicle?.registrationNumber || "—"}
                    </p>
                  </div>
                  {ride.startOtp && (
                    <div className="rounded-md bg-[#111111] px-4 py-3 text-white">
                      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60">Ride OTP</p>
                      <p className="mt-1 font-mono text-xl font-bold tracking-[0.3em]">{ride.startOtp}</p>
                    </div>
                  )}
                </div>

                <p className="mt-4 flex items-center gap-2 text-xs text-[#7A7A7A]">
                  <ShieldCheck size={14} className="text-[#111111]" />
                  {ride.startOtp
                    ? "Match the number plate, then share your OTP only once you're in the vehicle."
                    : "Your trip is in progress."}
                </p>
              </section>
            )}

            {/* Live map (OpenFreeMap): route, pickup/drop and the driver moving in real time */}
            <section className={`${card} overflow-hidden p-0! sm:p-0!`}>
              <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-4 sm:px-6">
                <CardHeader title="Live Tracking" />
                {live ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#111111]">
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    {ride.status === "DRIVER_ARRIVED"
                      ? "Driver at pickup"
                      : `~${live.etaMinutes} min ${live.heading === "PICKUP" ? "to pickup" : "to destination"}`}
                  </span>
                ) : (
                  <span className="text-xs text-[#7A7A7A]">{searching ? "Finding a driver…" : "Waiting for driver location"}</span>
                )}
              </div>
              <RideMap
                className="h-[320px] sm:h-[380px]"
                pickup={ride.pickup}
                destination={ride.destination}
                route={tripRoute}
                driver={driverPoint}
                driverRoute={driverRoute}
                fitKey={`${ride.id}|${ride.status}|${driverPoint ? "driver" : "none"}`}
              />
            </section>

            {/* Trip */}
            <section className={card}>
              <CardHeader title="Trip Details" />

              <div className="relative mt-6">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-[5px] top-[18px] bottom-[18px] w-px bg-[#111111]/25"
                />
                <div className="flex items-start gap-3">
                  <span className="relative z-10 mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
                    <span className="h-1 w-1 rounded-full bg-white" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">Pickup</p>
                    <p className="text-sm font-medium text-[#111111]">{ride.pickup.address}</p>
                  </div>
                </div>
                <div className="mt-5 flex items-start gap-3">
                  <span className="relative z-10 mt-1.5 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
                    <span className="h-1 w-1 rounded-full bg-white" />
                  </span>
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8A8A8A]">
                      Destination
                    </p>
                    <p className="text-sm font-medium text-[#111111]">{ride.destination.address}</p>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-3 gap-3">
                {[
                  { label: "Distance", value: formatKm(ride.distanceKm) },
                  { label: "Est. time", value: formatDuration(ride.estimatedDurationMinutes) },
                  { label: "Seats", value: String(option.seats) },
                ].map((item) => (
                  <div key={item.label} className="rounded-md bg-[#F4F4F4] px-4 py-3">
                    <p className={eyebrow}>{item.label}</p>
                    <p className="mt-1 text-sm font-bold text-[#111111]">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Cancel */}
            {canCancel &&
              (confirmCancel ? (
                <div
                  role="alertdialog"
                  aria-label="Confirm cancellation"
                  className="flex flex-col gap-3 rounded-md border border-[#F3C7C7] bg-[#FDF3F3] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="text-sm font-bold text-[#B42318]">Cancel this ride?</p>
                    <p className="text-xs text-[#7A7A7A]">
                      {searching
                        ? "We'll stop looking for a driver."
                        : "Your driver is already on the way and will be released."}
                    </p>
                    {cancelError && <p className="mt-1 text-xs font-medium text-[#B42318]">{cancelError}</p>}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmCancel(false)}
                      disabled={cancelling}
                      className="rounded-md border border-[#E8E8E8] bg-white px-4 py-2.5 text-sm font-semibold text-[#111111] transition-colors hover:bg-[#F4F4F4]"
                    >
                      Keep ride
                    </button>
                    <button
                      type="button"
                      onClick={handleCancel}
                      disabled={cancelling}
                      className="inline-flex items-center gap-2 rounded-md bg-[#D92D20] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_-6px_rgba(217,45,32,0.6)] transition-colors hover:bg-[#B42318] disabled:opacity-60"
                    >
                      {cancelling && <Loader2 size={14} className="animate-spin" />}
                      Yes, cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmCancel(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-[#D92D20] bg-[#D92D20] py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#B42318] active:scale-[0.99]"
                >
                  Cancel Ride
                </button>
              ))}
          </div>

          {/* ================= RIGHT: Fare ================= */}
          <aside className={`h-fit ${card}`}>
            <CardHeader title="Fare Details" />

            <dl className="mt-6 space-y-2.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-[#7A7A7A]">Vehicle</dt>
                <dd className="font-semibold text-[#111111]">{option.name}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7A7A7A]">Distance</dt>
                <dd className="font-semibold text-[#111111]">{formatKm(ride.distanceKm)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-[#7A7A7A]">Booked at</dt>
                <dd className="font-semibold text-[#111111]">
                  {new Date(ride.createdAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </dd>
              </div>
            </dl>

            {(ride.tipAmount ?? 0) > 0 && (
              <dl className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[#7A7A7A]">Ride fare</dt>
                  <dd className="font-semibold text-[#111111]">₹{ride.estimatedFare}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[#7A7A7A]">Driver tip</dt>
                  <dd className="font-semibold text-[#111111]">₹{ride.tipAmount}</dd>
                </div>
              </dl>
            )}

            <div className="mt-4 flex items-end justify-between border-t border-dashed border-[#D4D4D4] pt-4">
              <p className={eyebrow}>Estimated total</p>
              <p className="font-caslon text-4xl font-bold leading-none tracking-tight text-[#111111]">
                ₹{ride.estimatedFare + (ride.tipAmount ?? 0)}
              </p>
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-md bg-[#F4F4F4] px-3.5 py-3 text-xs text-[#7A7A7A]">
              <Clock size={14} className="mt-px shrink-0 text-[#111111]" />
              The fare is locked at booking. You&apos;ll pay at the end of the trip.
            </p>

            {loadError && (
              <p role="alert" className="mt-4 flex items-start gap-1.5 text-xs font-medium text-[#B3261E]">
                <AlertCircle size={14} className="mt-px shrink-0" />
                {loadError}
              </p>
            )}
          </aside>
        </div>
      </div>
    </>
  );
}
