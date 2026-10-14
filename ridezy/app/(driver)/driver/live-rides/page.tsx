"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Image from "next/image";
import {
  Navigation,
  MapPin,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Power,
  Check,
  X,
  Compass,
  Loader2,
  ExternalLink,
  User,
  Play,
  Square,
} from "lucide-react";
import RideOfferCard from "@/components/driver/RideOfferCard";
import PendingCashPayments from "@/components/driver/PendingCashPayments";
import RideChat from "@/components/chat/RideChat";
import RideMap from "@/components/map/RideMap";
import { SIM_SPEEDS, useDriveSimulation } from "@/lib/driveSimulator";
import type { LatLng } from "@/lib/mapGeo";
import { useTripRoutes } from "@/lib/useTripRoutes";
import { api, directionsUrl, formatDuration, formatKm, type RideStatus, type RideView } from "@/lib/rideApi";
import { API_BASE } from "@/lib/config";

// Backend marks a location stale after 60s (LOCATION_STALE_AFTER_SECONDS), so
// push well inside that window while online.
const LOCATION_PUSH_MS = 20_000;

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

type Availability = "AVAILABLE" | "OFFLINE" | "BUSY";

// Shape of `data` from GET/PATCH /api/drivers/location and PATCH /api/drivers/availability
interface DriverLocation {
  availabilityStatus: Availability;
  latitude: number | null;
  longitude: number | null;
  lastLocationUpdatedAt: string | null;
  isLocationStale: boolean;
}

async function driverApi(path: string, init?: RequestInit) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.clear();
    window.location.href = "/";
  }
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

function getBrowserPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Location is not supported by this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? "Allow location access in your browser to go online."
              : "Could not get your current location. Try again."
          )
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 10_000 }
    );
  });
}

// Until Socket.IO (Step 5) pushes offers, poll for them while online.
const RIDE_POLL_MS = 5_000;

/** GET /api/rides/history → data */
interface HistoryPage {
  rides: RideView[];
}

// All rides for history and today's completed rides.
const ALL_HISTORY_PATH = "/rides/history?limit=100";

/** Fare part of a ride (upfront pricing). */
const rideFare = (r: RideView) => r.finalFare ?? r.estimatedFare;
/** Tip on a ride: the payment's tip once there is one, else the tip the passenger offered. Cancelled = none. */
const rideTip = (r: RideView) => (r.status === "CANCELLED" ? 0 : (r.payment?.tipAmount ?? r.tipAmount ?? 0));
/** Total the passenger pays: the payment's amount (server-computed) when it exists, else fare + offered tip. */
const rideTotal = (r: RideView) => r.payment?.amount ?? rideFare(r) + rideTip(r);

/** "incl. ₹40 tip" under an amount; "(pending)" until the payment is confirmed. */
function TipNote({ ride }: { ride: RideView }) {
  const tip = rideTip(ride);
  if (tip <= 0) return null;
  return (
    <p className="text-[11px] font-semibold text-emerald-700">
      incl. ₹{tip} tip{ride.payment?.tipPaid ? "" : " (pending)"}
    </p>
  );
}

/** Pickup (green) and drop (black) on two lines, joined by a thin line. */
function RoutePoints({ pickup, destination, className = "" }: { pickup: string; destination: string; className?: string }) {
  return (
    <div className={`relative space-y-1.5 ${className}`}>
      <span aria-hidden="true" className="absolute left-[5px] top-[9px] bottom-[9px] w-px bg-stone-300" />
      <p className="relative flex min-w-0 items-center gap-2.5 text-[13px] text-stone-700">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-emerald-500 ring-[3px] ring-emerald-100" />
        <span className="sr-only">Pickup:</span>
        <span className="truncate">{pickup}</span>
      </p>
      <p className="relative flex min-w-0 items-center gap-2.5 text-[13px] text-stone-700">
        <span className="h-[11px] w-[11px] shrink-0 rounded-full bg-black ring-[3px] ring-stone-200" />
        <span className="sr-only">Drop:</span>
        <span className="truncate">{destination}</span>
      </p>
    </div>
  );
}

function minutesAgo(iso: string) {
  const m = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60_000));
  return m < 1 ? "just now" : `${m} min ago`;
}

function assignedTitle(status: RideStatus) {
  switch (status) {
    case "DRIVER_ARRIVED":
      return "Waiting for Passenger";
    case "RIDE_STARTED":
      return "Trip in Progress";
    default:
      return "Head to Pickup";
  }
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function formatRideDate(iso: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const time = d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
  if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}, ${time}`;
}

function renderRideStatus(status: RideStatus) {
  switch (status) {
    case "RIDE_COMPLETED":
      return <span className="text-[11px] font-bold uppercase text-emerald-700">COMPLETED</span>;
    case "CANCELLED":
      return <span className="text-[11px] font-bold uppercase text-rose-600">CANCELLED</span>;
    case "RIDE_STARTED":
      return <span className="text-[11px] font-bold uppercase text-stone-900">IN PROGRESS</span>;
    case "DRIVER_ARRIVED":
      return <span className="text-[11px] font-bold uppercase text-stone-900">ARRIVED</span>;
    case "DRIVER_ARRIVING":
    case "DRIVER_ASSIGNED":
      return <span className="text-[11px] font-bold uppercase text-stone-900">ASSIGNED</span>;
    default:
      return <span className="text-[11px] font-bold uppercase text-stone-600">{status.replace(/_/g, " ")}</span>;
  }
}

export default function DriverLiveRidesPage() {
  // null = still loading from GET /api/drivers/location
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const lastPushFailed = useRef(false);
  const isOnline = availability === "AVAILABLE" || availability === "BUSY";
  const [offers, setOffers] = useState<RideView[]>([]);
  const [assignedRide, setAssignedRide] = useState<RideView | null>(null);
  const [actingOn, setActingOn] = useState<string | null>(null); // ride id with accept/reject in flight
  const [history, setHistory] = useState<RideView[]>([]);
  const [rideFilter, setRideFilter] = useState<"ALL" | "COMPLETED" | "CANCELLED">("ALL");
  const [tripAction, setTripAction] = useState<"arrive" | "start" | "complete" | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  const handleOtpChange = (index: number, val: string) => {
    const clean = val.replace(/\D/g, "");
    if (!clean) {
      setOtpDigits((prev) => {
        const next = [...prev];
        next[index] = "";
        return next;
      });
      return;
    }

    // If multi-character entered (e.g. paste or autofill)
    if (clean.length > 1) {
      const digits = clean.slice(0, 4).split("");
      setOtpDigits((prev) => {
        const next = [...prev];
        digits.forEach((d, i) => {
          if (index + i < 4) next[index + i] = d;
        });
        return next;
      });
      const nextFocus = Math.min(index + digits.length, 3);
      otpRefs.current[nextFocus]?.focus();
      return;
    }

    const singleDigit = clean.slice(-1);
    setOtpDigits((prev) => {
      const next = [...prev];
      next[index] = singleDigit;
      return next;
    });

    if (index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      if (!otpDigits[index] && index > 0) {
        setOtpDigits((prev) => {
          const next = [...prev];
          next[index - 1] = "";
          return next;
        });
        otpRefs.current[index - 1]?.focus();
      }
    } else if (e.key === "ArrowLeft" && index > 0) {
      otpRefs.current[index - 1]?.focus();
    } else if (e.key === "ArrowRight" && index < 3) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    const digits = pasted.split("");
    setOtpDigits((prev) => {
      const next = ["", "", "", ""];
      digits.forEach((d, i) => {
        if (i < 4) next[i] = d;
      });
      return next;
    });
    const nextFocus = Math.min(digits.length, 3);
    otpRefs.current[nextFocus]?.focus();
  };

  const assignedRideId = useRef<string | null>(null);
  const seenOfferIds = useRef<Set<string>>(new Set());
  const offersFailed = useRef(false);
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    if (!message) return;
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3800);
  }, []);

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const fetchHistory = useCallback(() => {
    api<HistoryPage>(ALL_HISTORY_PATH).then(({ ok, data }) => setHistory(ok && data ? data.rides : []));
  }, []);

  // On load: my assigned ride (if any) and all trips.
  useEffect(() => {
    api<RideView>("/rides/current").then(({ ok, data }) => setAssignedRide(ok ? data : null));
    api<HistoryPage>(ALL_HISTORY_PATH).then(({ ok, data }) => setHistory(ok && data ? data.rides : []));
  }, []);

  // Remember the last assigned ride so a vanished "current" ride can be explained.
  useEffect(() => {
    if (assignedRide) assignedRideId.current = assignedRide.id;
  }, [assignedRide]);

  // Offers only matter while AVAILABLE (derived, not cleared in an effect).
  const visibleOffers = availability === "AVAILABLE" ? offers : [];

  // AVAILABLE: GET /api/drivers/rides/requests, the rides offered to me.
  useEffect(() => {
    if (availability !== "AVAILABLE") return;
    const load = async () => {
      const { ok, status, message, data } = await api<RideView[]>("/drivers/rides/requests");
      if (!ok || !Array.isArray(data)) {
        // Don't fail silently (e.g. 403 when another tab logged in as a passenger).
        if (!offersFailed.current) {
          showToast(
            status === 403
              ? "This tab is no longer signed in as a driver. Log in again (use a separate browser for the passenger)."
              : message || "Couldn't load ride requests.",
            "error"
          );
        }
        offersFailed.current = true;
        return;
      }
      offersFailed.current = false;
      const fresh = data.filter((r) => !seenOfferIds.current.has(r.id));
      fresh.forEach((r) => seenOfferIds.current.add(r.id));
      if (fresh.length > 0) {
        showToast(fresh.length === 1 ? "New ride request nearby!" : `${fresh.length} new ride requests nearby!`, "success");
      }
      setOffers(data);
    };
    load();
    const id = setInterval(load, RIDE_POLL_MS);
    return () => clearInterval(id);
  }, [availability, showToast]);

  // BUSY: keep the assigned ride fresh. If it is no longer current it either
  // completed (we did that) or the passenger cancelled; the backend has
  // already put me back to AVAILABLE either way.
  useEffect(() => {
    if (availability !== "BUSY") return;
    const load = async () => {
      const { ok, status, data } = await api<RideView>("/rides/current");
      if (ok && data) {
        setAssignedRide(data);
        return;
      }
      if (status === 404) {
        setAssignedRide(null);
        const lastId = assignedRideId.current;
        const last = lastId ? await api<RideView>(`/rides/${lastId}`) : null;
        if (last?.data?.status === "CANCELLED") {
          showToast("The passenger cancelled the ride. You're available again.", "info");
        }
        const loc = await api<DriverLocation>("/drivers/location");
        if (loc.ok && loc.data) {
          setDriverLocation(loc.data);
          setAvailability(loc.data.availabilityStatus);
        } else {
          setAvailability("OFFLINE");
        }
        fetchHistory();
      }
    };
    load();
    const id = setInterval(load, RIDE_POLL_MS);
    return () => clearInterval(id);
  }, [availability, showToast, fetchHistory]);

  // POST /api/rides/:id/accept: first driver wins (transaction on the backend).
  const handleAcceptRide = async (ride: RideView) => {
    setActingOn(ride.id);
    const { ok, message, data } = await api<RideView>(`/rides/${ride.id}/accept`, { method: "POST" });
    setActingOn(null);
    if (ok && data) {
      setAssignedRide(data);
      setOffers([]);
      setAvailability("BUSY");
      showToast(message || "Ride accepted. Head to the pickup point.", "success");
    } else {
      // Taken by another driver, expired or cancelled: drop it from the list.
      setOffers((prev) => prev.filter((o) => o.id !== ride.id));
      showToast(message, "error");
    }
  };

  // POST /api/rides/:id/reject: the ride moves on to other drivers.
  const handleDeclineRide = async (ride: RideView) => {
    setActingOn(ride.id);
    const { ok, message } = await api(`/rides/${ride.id}/reject`, { method: "POST" });
    setActingOn(null);
    setOffers((prev) => prev.filter((o) => o.id !== ride.id));
    showToast(ok ? message || "Ride request declined." : message, ok ? "info" : "error");
  };

  // Trip lifecycle (assigned driver only): arrive → start with OTP → complete.
  const runTripAction = async (action: "arrive" | "start" | "complete", body?: unknown) => {
    if (!assignedRide) return null;
    setTripAction(action);
    const res = await api<RideView>(`/rides/${assignedRide.id}/${action}`, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    setTripAction(null);
    if (!res.ok) showToast(res.message, "error");
    return res;
  };

  const handleArrived = async () => {
    const res = await runTripAction("arrive");
    if (res?.ok && res.data) {
      setAssignedRide(res.data);
      showToast(res.message || "Passenger notified that you have arrived.", "info");
    }
  };

  const handleStartTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    const otp = otpDigits.join("").trim();
    if (otp.length !== 4) return;
    const res = await runTripAction("start", { otp });
    if (res?.ok && res.data) {
      setAssignedRide(res.data);
      setOtpDigits(["", "", "", ""]);
      showToast(res.message || "Ride started. Drive safely.", "success");
    }
  };

  const handleCompleteTrip = async () => {
    const res = await runTripAction("complete");
    if (res?.ok && res.data) {
      setAssignedRide(null);
      setAvailability("AVAILABLE"); // backend frees the driver in the same transaction
      fetchHistory();
      showToast(`Trip complete! Collect ₹${res.data.finalFare ?? res.data.estimatedFare} from the passenger.`, "success");
    }
  };

  const completedToday = history.filter((r) => r.status === "RIDE_COMPLETED" && r.completedAt && isToday(r.completedAt));
  const earnedToday = completedToday.reduce((sum, r) => sum + rideTotal(r), 0);

  const filteredRides = history.filter((r) => {
    if (rideFilter === "COMPLETED") return r.status === "RIDE_COMPLETED";
    if (rideFilter === "CANCELLED") return r.status === "CANCELLED";
    return true;
  });

  // GET /api/drivers/location: restore online/offline state on page load.
  // 404 means no location shared yet, i.e. the driver is offline.
  useEffect(() => {
    (async () => {
      try {
        const { ok, json } = await driverApi("/drivers/location");
        if (ok && json.data) {
          setDriverLocation(json.data);
          setAvailability(json.data.availabilityStatus);
        } else {
          setAvailability("OFFLINE");
        }
      } catch {
        setAvailability("OFFLINE");
      }
    })();
  }, []);

  // Browser GPS -> PATCH /api/drivers/location. Throws with a user-facing message.
  const pushLocation = useCallback(async () => {
    const coords = await getBrowserPosition();
    const { ok, json } = await driverApi("/drivers/location", {
      method: "PATCH",
      body: JSON.stringify(coords),
    });
    if (!ok) throw new Error(json.message || "Failed to update location.");
    setDriverLocation(json.data);
    return json.data as DriverLocation;
  }, []);

  /* ---------- Map + drive simulation (testing without moving) ---------- */
  const sendSimulatedLocation = useCallback(async (point: LatLng) => {
    const { ok, json } = await driverApi("/drivers/location", { method: "PATCH", body: JSON.stringify(point) });
    if (!ok) throw new Error(json.message || "Failed to update location.");
    setDriverLocation(json.data);
  }, []);
  const arrivalMessage = useRef("");
  const simulation = useDriveSimulation({
    onPosition: sendSimulatedLocation,
    onArrive: () => showToast(arrivalMessage.current, "success"),
  });
  const simulatingRef = useRef(false);
  useEffect(() => {
    simulatingRef.current = simulation.running;
  }, [simulation.running]);

  const driverLat = driverLocation?.latitude ?? null;
  const driverLng = driverLocation?.longitude ?? null;
  const driverPoint = useMemo(
    () => (driverLat !== null && driverLng !== null ? { latitude: driverLat, longitude: driverLng } : null),
    [driverLat, driverLng],
  );
  const headingToDestination = assignedRide?.status === "RIDE_STARTED";
  const simTarget = assignedRide ? (headingToDestination ? assignedRide.destination : assignedRide.pickup) : null;
  const canSimulate =
    assignedRide !== null &&
    (assignedRide.status === "DRIVER_ASSIGNED" || assignedRide.status === "DRIVER_ARRIVING" || headingToDestination);
  const { route: tripRoute, driverRoute } = useTripRoutes(
    assignedRide?.pickup,
    assignedRide?.destination,
    driverPoint,
    canSimulate ? simTarget : null,
  );

  const startSimulation = () => {
    if (!assignedRide || !simTarget) return;
    // Start from the current position, or ~1.5 km north of the pickup without one.
    const from = driverPoint ?? { latitude: assignedRide.pickup.latitude + 0.0135, longitude: assignedRide.pickup.longitude };
    arrivalMessage.current = headingToDestination
      ? "Reached the destination. Complete the trip to collect the fare."
      : "Reached the pickup point. Tap \"I Have Arrived at Pickup\".";
    void simulation.start(from, simTarget);
  };

  // Ride ended or moved to a stage with nowhere to drive: stop simulating.
  const stopSimulation = simulation.stop;
  useEffect(() => {
    if (!canSimulate) stopSimulation();
  }, [canSimulate, stopSimulation]);

  // While online, keep the location fresh so the backend keeps matching us.
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(async () => {
      if (simulatingRef.current) return; // the drive simulator is sending positions
      try {
        await pushLocation();
        lastPushFailed.current = false;
      } catch (err) {
        // Toast once per failure streak, not every tick.
        if (!lastPushFailed.current) showToast((err as Error).message, "error");
        lastPushFailed.current = true;
      }
    }, LOCATION_PUSH_MS);
    return () => clearInterval(id);
  }, [isOnline, pushLocation, showToast]);

  const setBackendAvailability = async (status: "AVAILABLE" | "OFFLINE") => {
    const { ok, json } = await driverApi("/drivers/availability", {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    if (!ok) throw new Error(json.message || "Failed to update availability.");
    setDriverLocation(json.data);
    setAvailability(json.data.availabilityStatus);
    return json.message as string;
  };

  const handleToggleOnline = async () => {
    if (isToggling || availability === null || availability === "BUSY") return;
    setIsToggling(true);
    try {
      if (isOnline) {
        // Backend clears the stored location when going OFFLINE.
        const message = await setBackendAvailability("OFFLINE");
        setOffers([]);
        showToast(message || "You are now offline.", "info");
      } else {
        // Going online requires a fresh location, so send it first.
        await pushLocation();
        const message = await setBackendAvailability("AVAILABLE");
        lastPushFailed.current = false;
        showToast(message || "You are now online.", "success");
      }
    } catch (err) {
      showToast((err as Error).message || "Something went wrong.", "error");
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFA] pb-24 text-black">
      {/* Toast Notification Container (Bottom-Right) */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-black text-white shadow-xl border border-neutral-800 text-xs animate-in slide-in-from-bottom-3 duration-200"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {toast.type === "success" && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
              {toast.type === "error" && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />}
              {toast.type === "info" && <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0" />}
              <span className="truncate">{toast.message}</span>
            </div>
            <button
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white p-0.5 cursor-pointer shrink-0"
              aria-label="Dismiss toast"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      <div className="w-full px-4 sm:px-6 lg:px-8 pt-3 sm:pt-4 space-y-6">

        {/* 1. HEADER BANNER */}
        <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[170px] sm:h-[190px] lg:h-[205px] flex items-center w-full shrink-0">
          <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
            <Image
              src="/smiling-driver-banner.webp"
              alt="Smiling Taxi Driver City Banner"
              fill
              priority
              sizes="100vw"
              className="object-cover"
              style={{ objectPosition: "center 15%" }}
            />
          </div>

          <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#555550]">
                  Live Dispatch &bull; Ridezy Driver
                </span>
                <span className="text-[11px] font-bold text-[#777770]">&bull;</span>
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] ${
                    isOnline ? "text-emerald-700" : "text-zinc-500"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      isOnline ? "bg-emerald-500 animate-pulse" : "bg-zinc-400"
                    }`}
                  />
                  {availability === null
                    ? "CHECKING..."
                    : availability === "BUSY"
                    ? "ON A RIDE"
                    : isOnline
                    ? "DISPATCH ACTIVE"
                    : "OFFLINE"}
                </span>
              </div>
              <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111111] tracking-tight leading-tight mt-1">
                Live Rides
              </h1>
              <p className="text-xs sm:text-sm text-zinc-700 mt-1 sm:mt-1.5 font-medium leading-relaxed">
                Receive real-time ride requests, verify passenger OTP, and navigate active trips.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleToggleOnline}
                disabled={isToggling || availability === null || availability === "BUSY"}
                className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed ${
                  isOnline
                    ? "bg-black text-white hover:bg-neutral-800"
                    : "bg-emerald-600 text-white hover:bg-emerald-700"
                }`}
              >
              <Power className="w-4 h-4" />
              <span>
                {availability === null
                  ? "Checking..."
                  : isToggling
                  ? "Updating..."
                  : availability === "BUSY"
                  ? "On a Ride"
                  : isOnline
                  ? "Go Offline"
                  : "Go Online Now"}
              </span>
            </button>
          </div>
        </div>
      </div>

        {/* 2. MAIN DISPATCH HUD */}
        {isOnline ? (
          assignedRide ? (
            /* ---------- Assigned ride (after accept) ---------- */
            <div className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#F0EFEA]">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-black text-white flex items-center justify-center shrink-0">
                    <Navigation className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="font-caslon text-xl sm:text-2xl font-bold text-[#111111]">
                        {assignedTitle(assignedRide.status)}
                      </h2>
                      <span className="font-mono text-xs text-stone-500 font-semibold">
                        #{assignedRide.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500 mt-0.5">
                      Accepted {assignedRide.assignedAt ? minutesAgo(assignedRide.assignedAt) : ""} &bull; the
                      passenger can see your name, vehicle and number plate.
                    </p>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                    {rideTip(assignedRide) > 0 ? "Est. Total" : "Est. Fare"}
                  </p>
                  <p className="font-caslon text-2xl sm:text-3xl font-bold text-[#111111] mt-0.5">
                    ₹{rideTotal(assignedRide)}
                  </p>
                  {rideTip(assignedRide) > 0 && (
                    <p className="text-[11px] font-semibold text-emerald-700">
                      ₹{rideFare(assignedRide)} fare + ₹{rideTip(assignedRide)} tip
                    </p>
                  )}
                </div>
              </div>

              {/* Live map (OpenFreeMap) with the drive simulator for testing */}
              <div className="relative overflow-hidden rounded-2xl border border-[#EDEDE8]">
                <RideMap
                  className="h-[300px] sm:h-[360px]"
                  pickup={assignedRide.pickup}
                  destination={assignedRide.destination}
                  route={tripRoute}
                  driver={driverPoint}
                  driverRoute={driverRoute}
                  fitKey={`${assignedRide.id}|${assignedRide.status}|${driverPoint ? "driver" : "none"}`}
                />
                <div className="absolute bottom-3 left-3 right-14 sm:right-auto sm:max-w-sm">
                  <div className="flex items-center gap-2 rounded-xl bg-white/95 p-2 shadow-[0_8px_24px_-8px_rgba(0,0,0,0.3)] ring-1 ring-black/5 backdrop-blur">
                    {simulation.running ? (
                      <>
                        <div className="min-w-0 flex-1 px-1">
                          <p className="text-[11px] font-bold text-black">
                            Simulating drive to {headingToDestination ? "destination" : "pickup"} ·{" "}
                            {simulation.remainingKm.toFixed(1)} km left
                          </p>
                          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-stone-200">
                            <div
                              className="h-full rounded-full bg-black transition-all duration-700"
                              style={{ width: `${Math.round(simulation.progress * 100)}%` }}
                            />
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={simulation.stop}
                          aria-label="Stop simulation"
                          className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-black text-white hover:bg-neutral-800"
                        >
                          <Square className="size-3.5 fill-current" />
                        </button>
                      </>
                    ) : canSimulate ? (
                      <>
                        <button
                          type="button"
                          onClick={startSimulation}
                          className="flex items-center gap-2 rounded-lg bg-black px-3 py-2 text-[11px] font-bold text-white hover:bg-neutral-800"
                        >
                          <Play className="size-3.5 fill-current" />
                          Simulate drive to {headingToDestination ? "destination" : "pickup"}
                        </button>
                        <div className="flex rounded-lg bg-stone-100 p-0.5" role="radiogroup" aria-label="Simulation speed">
                          {SIM_SPEEDS.map((option) => (
                            <button
                              key={option.id}
                              type="button"
                              role="radio"
                              aria-checked={simulation.speed === option.id}
                              onClick={() => simulation.setSpeed(option.id)}
                              className={`rounded-md px-2 py-1 text-[11px] font-bold ${
                                simulation.speed === option.id ? "bg-white text-black shadow-xs" : "text-stone-500"
                              }`}
                            >
                              {option.label}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <p className="px-1 text-[11px] font-semibold text-stone-600">
                        At the pickup. Verify the passenger&apos;s OTP to start the trip.
                      </p>
                    )}
                  </div>
                  {simulation.error && (
                    <p className="mt-1.5 rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-medium text-rose-700">
                      {simulation.error}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* Route */}
                <div className="lg:col-span-7 rounded-2xl bg-[#FAFAF8] border border-[#EDEDE8] p-5 space-y-5">
                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="mt-1 flex flex-col items-center">
                        <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100" />
                        <div className="w-0.5 h-10 bg-stone-300 my-1" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Pickup</p>
                        <p className="text-sm font-bold text-black mt-0.5">{assignedRide.pickup.address}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div className="mt-1">
                        <div className="w-3.5 h-3.5 rounded-full bg-black ring-4 ring-neutral-200" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Drop</p>
                        <p className="text-sm font-bold text-black mt-0.5">{assignedRide.destination.address}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-[#ECEBE5] text-center">
                    <div className="rounded-xl bg-white border border-[#EDEDE8] p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Distance</p>
                      <p className="font-caslon text-base font-bold text-black mt-0.5">
                        {formatKm(assignedRide.distanceKm)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-[#EDEDE8] p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Duration</p>
                      <p className="font-caslon text-base font-bold text-black mt-0.5">
                        {formatDuration(assignedRide.estimatedDurationMinutes)}
                      </p>
                    </div>
                    <div className="rounded-xl bg-white border border-[#EDEDE8] p-2.5">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-stone-400">Vehicle</p>
                      <p className="font-caslon text-base font-bold text-black mt-0.5">{assignedRide.vehicleType}</p>
                    </div>
                  </div>
                </div>

                {/* Passenger & actions */}
                <div className="lg:col-span-5 rounded-2xl bg-[#FAFAF8] border border-[#EDEDE8] p-5 space-y-5 flex flex-col justify-between">
                  <div className="flex items-center gap-3 pb-3 border-b border-[#ECEBE5]">
                    <div className="w-12 h-12 rounded-full bg-black text-white flex items-center justify-center font-bold text-base shadow-xs">
                      {(assignedRide.passenger?.name || "P").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-caslon text-base font-bold text-black">
                        {assignedRide.passenger?.name || "Passenger"}
                      </p>
                      <p className="text-xs text-stone-500 mt-0.5">Booked {minutesAgo(assignedRide.createdAt)}</p>
                    </div>
                    {/* Chat + call: open until the ride ends */}
                    <RideChat rideId={assignedRide.id} rideStatus={assignedRide.status} variant="icons" className="ml-auto" />
                  </div>

                  <div className="space-y-2">
                    <a
                      href={directionsUrl(assignedRide.pickup)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all shadow-xs flex items-center justify-center gap-2"
                    >
                      <MapPin className="w-4 h-4" />
                      <span>Navigate to Pickup</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>
                    <a
                      href={directionsUrl(assignedRide.destination)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl border border-stone-200 bg-white text-black text-xs font-semibold hover:bg-stone-50 transition-colors flex items-center justify-center gap-2"
                    >
                      <Navigation className="w-4 h-4" />
                      <span>Route to Drop</span>
                      <ExternalLink className="w-3.5 h-3.5 opacity-70" />
                    </a>

                    {/* Trip stage actions */}
                    {(assignedRide.status === "DRIVER_ASSIGNED" || assignedRide.status === "DRIVER_ARRIVING") && (
                      <button
                        type="button"
                        onClick={handleArrived}
                        disabled={tripAction !== null}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {tripAction === "arrive" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <MapPin className="w-4 h-4" />
                        )}
                        <span>I Have Arrived at Pickup</span>
                      </button>
                    )}

                    {assignedRide.status === "DRIVER_ARRIVED" && (
                      <form
                        onSubmit={handleStartTrip}
                        className="space-y-3 p-4 rounded-2xl bg-white border border-[#EDEDE8] shadow-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-600">
                            Ask passenger for 4-digit ride OTP
                          </span>
                          <span className="text-[10px] font-semibold text-stone-400">
                            {otpDigits.filter(Boolean).length}/4 entered
                          </span>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                          {/* 4 Digit Boxes */}
                          <div
                            className="flex items-center gap-2 sm:gap-2.5"
                            onPaste={handleOtpPaste}
                          >
                            {otpDigits.map((digit, index) => (
                              <input
                                key={index}
                                ref={(el) => {
                                  otpRefs.current[index] = el;
                                }}
                                type="text"
                                inputMode="numeric"
                                autoComplete="one-time-code"
                                maxLength={1}
                                value={digit}
                                onChange={(e) => handleOtpChange(index, e.target.value)}
                                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                                onFocus={(e) => e.target.select()}
                                placeholder="•"
                                aria-label={`Ride OTP digit ${index + 1}`}
                                className={`w-11 h-12 sm:w-12 sm:h-12 rounded-xl text-center text-lg sm:text-xl font-mono font-bold transition-all border outline-none shadow-2xs select-all ${
                                  digit
                                    ? "border-black bg-white text-black ring-1 ring-black"
                                    : "border-stone-200 bg-[#FAFAFA] text-stone-300 focus:border-black focus:bg-white focus:text-black focus:ring-1 focus:ring-black"
                                }`}
                              />
                            ))}
                          </div>

                          {/* Verify & Start Button */}
                          <button
                            type="submit"
                            disabled={otpDigits.join("").length !== 4 || tripAction !== null}
                            className="sm:ml-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs whitespace-nowrap"
                          >
                            {tripAction === "start" && <Loader2 className="w-4 h-4 animate-spin" />}
                            Verify &amp; Start
                          </button>
                        </div>
                      </form>
                    )}

                    {assignedRide.status === "RIDE_STARTED" && (
                      <button
                        type="button"
                        onClick={handleCompleteTrip}
                        disabled={tripAction !== null}
                        className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {tripAction === "complete" ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        <span>Complete Trip &amp; Collect ₹{rideTotal(assignedRide)}</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : visibleOffers.length > 0 ? (
            /* ---------- Incoming offers ---------- */
            <div className="space-y-4">
              {visibleOffers.map((offer) => (
                <RideOfferCard
                  key={offer.id}
                  offer={offer}
                  busy={actingOn === offer.id}
                  disabled={actingOn !== null}
                  onAccept={handleAcceptRide}
                  onDecline={handleDeclineRide}
                />
              ))}
            </div>
          ) : (
            /* ---------- Waiting for offers ---------- */
            <div className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-12 text-center space-y-4 shadow-xs">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-neutral-100 border border-neutral-200">
                <span className="absolute inset-0 rounded-2xl border-2 border-emerald-400/50 animate-ping" />
                <Compass className="w-8 h-8 text-black" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h3 className="font-caslon text-xl font-bold text-black">Waiting for Ride Requests</h3>
                <p className="text-xs text-stone-500">
                  You&apos;re visible to passengers nearby. Requests appear here automatically. Keep this page open
                  so your location stays fresh.
                </p>
              </div>
            </div>
          )
        ) : (
          /* Offline Notice */
          <div className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-12 text-center space-y-4 shadow-xs">
            <div className="w-16 h-16 mx-auto flex items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
              <Power className="w-8 h-8" />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-caslon text-xl font-bold text-black">You are Currently Offline</h3>
              <p className="text-xs text-stone-500">
                Switch your status to Online to appear on passenger radars and receive instant trip bookings.
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleOnline}
              disabled={isToggling || availability === null}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-colors cursor-pointer shadow-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Power className="w-4 h-4" />
              <span>{availability === null ? "Checking..." : isToggling ? "Updating..." : "Go Online Now"}</span>
            </button>
          </div>
        )}

        {/* Cash to collect from finished rides (confirm once received) */}
        <PendingCashPayments />

        {/* 3. RIDES COMPLETED TODAY (GET /api/drivers/rides/history) */}
        <section className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#F0EFEA]">
            <div>
              <h3 className="font-caslon text-xl font-bold text-[#111111]">Rides Completed Today</h3>
              <p className="text-xs text-stone-500 mt-0.5">Summary of your fulfilled pickups and fares earned today.</p>
            </div>
            <span className="text-xs font-semibold text-stone-600 bg-neutral-100 px-3 py-1 rounded-lg border border-neutral-200 whitespace-nowrap">
              {completedToday.length} {completedToday.length === 1 ? "Trip" : "Trips"} &bull; ₹
              {earnedToday.toLocaleString("en-IN")} Earned
            </span>
          </div>

          {completedToday.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">No completed rides yet today.</div>
          ) : (
            <div className="space-y-3">
              {completedToday.map((ride) => (
                <div
                  key={ride.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#EDEDE8] bg-[#FAFAF8] hover:border-[#DCDCD4] transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#EDEDE8] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-black truncate">{ride.passenger?.name || "Passenger"}</p>
                        <span className="text-[10px] text-stone-400 font-mono font-semibold">
                          #{ride.id.slice(-6).toUpperCase()}
                        </span>
                      </div>
                      <RoutePoints pickup={ride.pickup.address} destination={ride.destination.address} className="mt-1" />
                      <p className="text-[10px] text-stone-400 mt-0.5">
                        Completed{" "}
                        {new Date(ride.completedAt!).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                        {" "}&bull; {formatKm(ride.distanceKm)}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-caslon text-lg font-bold text-black">₹{rideTotal(ride)}</p>
                    <TipNote ride={ride} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 4. ALL RIDES */}
        <section className="rounded-2xl sm:rounded-3xl border border-[#EDEDE8] bg-white p-6 sm:p-8 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#F0EFEA]">
            <div>
              <h3 className="font-caslon text-xl font-bold text-[#111111]">All Rides</h3>
              <p className="text-xs text-stone-500 mt-0.5">Complete history of all assigned and fulfilled trips.</p>
            </div>
            <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
              <button
                type="button"
                onClick={() => setRideFilter("ALL")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                  rideFilter === "ALL"
                    ? "bg-black text-white border-black"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                ALL ({history.length})
              </button>
              <button
                type="button"
                onClick={() => setRideFilter("COMPLETED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                  rideFilter === "COMPLETED"
                    ? "bg-black text-white border-black"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                COMPLETED ({history.filter((r) => r.status === "RIDE_COMPLETED").length})
              </button>
              <button
                type="button"
                onClick={() => setRideFilter("CANCELLED")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border ${
                  rideFilter === "CANCELLED"
                    ? "bg-black text-white border-black"
                    : "bg-white text-stone-600 border-stone-200 hover:bg-stone-50"
                }`}
              >
                CANCELLED ({history.filter((r) => r.status === "CANCELLED").length})
              </button>
            </div>
          </div>

          {filteredRides.length === 0 ? (
            <div className="py-8 text-center text-xs text-stone-400">
              No rides found in this category.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRides.map((ride) => (
                <div
                  key={ride.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border border-[#EDEDE8] bg-[#FAFAF8] hover:border-[#DCDCD4] transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-[#EDEDE8] flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-stone-700" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-black truncate">{ride.passenger?.name || "Passenger"}</p>
                        <span className="text-[10px] text-stone-400 font-mono font-semibold">
                          #{ride.id.slice(-6).toUpperCase()}
                        </span>
                        {renderRideStatus(ride.status)}
                      </div>
                      <RoutePoints pickup={ride.pickup.address} destination={ride.destination.address} />
                      <div className="flex items-center gap-2 text-[10px] text-stone-400 flex-wrap">
                        <span>{formatRideDate(ride.completedAt || ride.createdAt)}</span>
                        <span>&bull;</span>
                        <span>{formatKm(ride.distanceKm)}</span>
                        {ride.vehicleType && (
                          <>
                            <span>&bull;</span>
                            <span className="uppercase">{ride.vehicleType}</span>
                          </>
                        )}
                        {ride.cancellationReason && (
                          <>
                            <span>&bull;</span>
                            <span className="text-rose-600 italic">Reason: {ride.cancellationReason}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 self-end sm:self-center">
                    <p className="font-caslon text-lg font-bold text-black">
                      ₹{rideTotal(ride)}
                    </p>
                    <TipNote ride={ride} />
                    {ride.payment?.status && (
                      <span className="text-[10px] font-bold uppercase text-stone-500">
                        {ride.payment.status}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </div>
  );
}
