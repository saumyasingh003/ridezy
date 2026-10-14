"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Car,
  TrendingUp,
  Clock,
  Star,
  MapPin,
  CheckCircle2,
  Navigation,
  Phone,
  ShieldCheck,
  AlertCircle,
  X,
  Check,
  ArrowRight,
  Zap,
  Sparkles,
  Radio,
} from "lucide-react";

import DriverRideRequests from "@/components/driver/DriverRideRequests";
import PendingCashPayments from "@/components/driver/PendingCashPayments";
import { api, type ReceivedRatings, type PaymentHistory } from "@/lib/rideApi";
import { API_BASE } from "@/lib/config";


interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export default function DriverDashboardPage() {
  const router = useRouter();
  const [driverName, setDriverName] = useState("Partner");
  const [driverPhone, setDriverPhone] = useState("+91 98765 43210");
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    if (!message) return;
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  // Automatically redirect /driver#profile to /driver/profile
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (window.location.hash === "#profile") {
        router.replace("/driver/profile");
      }
      const handleHashChange = () => {
        if (window.location.hash === "#profile") {
          router.replace("/driver/profile");
        }
      };
      window.addEventListener("hashchange", handleHashChange);
      return () => window.removeEventListener("hashchange", handleHashChange);
    }
  }, [router]);

  // 1. GET /api/drivers/profile to populate name & phone
  const fetchDriverProfile = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/drivers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 401) {
        if (typeof window !== "undefined") {
          localStorage.clear();
          window.location.href = "/";
        }
        return;
      }

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        if (json.data.name) {
          setDriverName(json.data.name);
          if (typeof window !== "undefined") {
            localStorage.setItem("userName", json.data.name);
            window.dispatchEvent(
              new CustomEvent("userNameUpdated", { detail: { name: json.data.name } })
            );
          }
        }
        if (json.data.phone) setDriverPhone(json.data.phone);
        if (json.data.verificationStatus) setVerificationStatus(json.data.verificationStatus);
      }
    } catch {}
  };



  // Real Backend Data: Trips & Earnings (GET /api/drivers/rides/history)
  const [tripEarnings, setTripEarnings] = useState<number | null>(null);
  const [completedTripsCount, setCompletedTripsCount] = useState<number | null>(null);
  const [recentTrips, setRecentTrips] = useState<Array<{
    id: string;
    passenger: string;
    route: string;
    pickup?: string;
    dropoff?: string;
    fare: string;
    rawFare: number;
    status: string;
    time: string;
  }>>([]);

  const fetchTripsHistory = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/drivers/rides/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success && Array.isArray(json.data)) {
          setRecentTrips(json.data);
          const completed = json.data.filter((t: any) => t.status === "RIDE_COMPLETED");
          const totalFare = completed.reduce((sum: number, t: any) => sum + (Number(t.rawFare) || 0), 0);
          setTripEarnings(completed.length > 0 ? totalFare : null);
          setCompletedTripsCount(completed.length > 0 ? completed.length : null);
          return;
        }
      }
      setRecentTrips([]);
      setTripEarnings(null);
      setCompletedTripsCount(null);
    } catch {
      setRecentTrips([]);
      setTripEarnings(null);
      setCompletedTripsCount(null);
    }
  };

  // Real Backend Data: Vehicle (GET /api/drivers/vehicle) & Profile Status & Documents
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [vehicle, setVehicle] = useState<{
    make?: string;
    model?: string;
    registrationNumber?: string;
    vehicleType?: string;
    year?: number;
    color?: string;
  } | null>(null);

  const [documents, setDocuments] = useState<Array<{
    documentType: string;
    documentNumber: string;
    verificationStatus: string;
  }>>([]);

  const fetchVehicle = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/drivers/vehicle`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success && json.data) {
          setVehicle(json.data);
          return;
        }
      }
      setVehicle(null);
    } catch {
      setVehicle(null);
    }
  };

  const fetchDocuments = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/drivers/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        if (json.success && Array.isArray(json.data)) {
          setDocuments(json.data);
          return;
        }
      }
      setDocuments([]);
    } catch {
      setDocuments([]);
    }
  };

  // Driver Rating card: average of passengers' ratings (GET /api/ratings/me)
  const [ratingSummary, setRatingSummary] = useState<ReceivedRatings["summary"] | null>(null);
  const [paymentSummary, setPaymentSummary] = useState<PaymentHistory["summary"] | null>(null);

  const fetchPayments = async () => {
    try {
      const { ok, data } = await api<PaymentHistory>("/payments/history?limit=1");
      if (ok && data?.summary) setPaymentSummary(data.summary);
    } catch {}
  };

  useEffect(() => {
    api<ReceivedRatings>("/ratings/me?limit=1").then(({ ok, data }) => {
      if (ok && data) setRatingSummary(data.summary);
    });
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("userName");
      const storedPhone = localStorage.getItem("userPhone");
      if (storedName) setDriverName(storedName);
      if (storedPhone) setDriverPhone(`+91 ${storedPhone}`);
    }
    fetchDriverProfile();
    fetchVehicle();
    fetchDocuments();
    fetchTripsHistory();
    fetchPayments();
  }, []);



  // The list shows only the latest trips (the API returns newest first); stats use all of them.
  const RECENT_TRIPS_SHOWN = 5;
  const latestTrips = recentTrips.slice(0, RECENT_TRIPS_SHOWN);
  const completedTrips = recentTrips.filter((t) => t.status === "RIDE_COMPLETED");
  const cancelledTrips = recentTrips.filter((t) => t.status === "CANCELLED");
  const totalRidesCount = completedTripsCount ?? completedTrips.length;
  const totalEarnedAmount = paymentSummary?.paidAmount ?? (tripEarnings ?? 0);
  const paidRidesCount = paymentSummary?.paidCount ?? totalRidesCount;
  const acceptanceRate = recentTrips.length > 0
    ? Math.max(0, Math.min(100, Math.round(((recentTrips.length - cancelledTrips.length) / recentTrips.length) * 100)))
    : 100;

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 sm:space-y-8">
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[170px] sm:h-[190px] lg:h-[205px] flex items-center w-full shrink-0">
        {/* Banner Background Image */}
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

        <div className="relative z-10 w-full px-6 sm:px-8 lg:px-12 flex flex-col justify-center">
          <div className="max-w-2xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#555550]">
              Partner Portal &bull; Ridezy Driver
            </span>
            <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Welcome back, {driverName}!
            </h1>
            <p className="text-xs sm:text-sm text-zinc-700 mt-1 sm:mt-1.5 font-medium leading-relaxed">
              Track your active rides, daily earnings, and partner performance.
            </p>
          </div>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Earnings */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Total Earnings
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60 font-semibold text-xs">
              ₹
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              ₹{totalEarnedAmount.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">
              {paidRidesCount > 0
                ? `${paidRidesCount} paid ${paidRidesCount === 1 ? "ride" : "rides"} • Avg ₹${Math.round(totalEarnedAmount / Math.max(paidRidesCount, 1))}/ride`
                : "No completed rides yet"}
            </p>
          </div>
        </div>

        {/* Completed Trips */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Completed Trips
            </span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/60">
              <Car className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {totalRidesCount} {totalRidesCount === 1 ? "Ride" : "Rides"}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">
              {recentTrips.length > 0
                ? `${Math.round((totalRidesCount / recentTrips.length) * 100)}% completion rate`
                : "Ready to accept rides"}
            </p>
          </div>
        </div>

        {/* Acceptance Rate */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Acceptance Rate
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
              <ShieldCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {acceptanceRate}%
            </p>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">
              {recentTrips.length > 0
                ? `${recentTrips.length - cancelledTrips.length}/${recentTrips.length} accepted • Benchmark ≥ 85%`
                : "100% target • Standard tier"}
            </p>
          </div>
        </div>

        {/* Driver Rating */}
        <div className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Driver Rating
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/60">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {ratingSummary?.average != null ? `${ratingSummary.average.toFixed(1)} ★` : "5.0 ★"}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 font-medium">
              {ratingSummary?.count
                ? `${ratingSummary.count} ${ratingSummary.count === 1 ? "passenger rating" : "passenger ratings"} • 100% positive`
                : "5.0 baseline • Top rated partner"}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Active/Incoming Dispatch (Left 60%) + Quick Info & Documents (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="rides">
        {/* Left Column: Live Ride Dispatch & Current Trip */}
        <div className="lg:col-span-7 space-y-6">


          {/* Recent Completed Trips List */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-caslon text-lg font-bold text-black">
                Recent Trips 
              </h3>
              <div>
                <span className="text-xs font-semibold text-zinc-500">
                  {recentTrips.length > RECENT_TRIPS_SHOWN
                    ? `Latest ${RECENT_TRIPS_SHOWN} of ${recentTrips.length} trips`
                    : `${recentTrips.length} Total Trips`}
                </span>
              </div>
            </div>

            {/* Incoming ride requests (GET /api/drivers/rides/requests) */}
            <DriverRideRequests compact />

            {/* Cash a passenger chose to pay, waiting for this driver to confirm */}
            <div className="mb-5 empty:hidden">
              <PendingCashPayments />
            </div>

            {recentTrips.length > 0 ? (
              <div className="space-y-3">
                {latestTrips.map((trip) => {
                  const [routeFrom, routeTo] = trip.route.split(" → ");
                  const from = trip.pickup || routeFrom || "—";
                  const to = trip.dropoff || routeTo || "—";
                  const completed = trip.status === "RIDE_COMPLETED";
                  const cancelled = trip.status === "CANCELLED";
                  const statusLabel = completed
                    ? "Completed"
                    : cancelled
                    ? "Cancelled"
                    : trip.status === "RIDE_STARTED"
                    ? "On trip"
                    : "In progress";
                  return (
                    <div
                      key={trip.id}
                      className="group flex items-start gap-3 sm:gap-4 rounded-xl border border-[#EDEDE8] bg-[#FAFAF8] p-3.5 sm:p-4 transition-colors hover:border-[#DCDCD4] hover:bg-white"
                    >
                      {/* Passenger */}
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-black text-sm font-bold text-white">
                        {(trip.passenger || "P").charAt(0).toUpperCase()}
                      </div>

                      {/* Route */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-semibold text-black truncate">{trip.passenger}</span>
                          <span className="text-stone-300">•</span>
                          <span className="text-stone-500 whitespace-nowrap">{trip.time}</span>
                        </div>

                        <div className="relative mt-2.5 space-y-2 pl-5">
                          <span
                            aria-hidden="true"
                            className="absolute left-[4px] top-[7px] bottom-[7px] w-px bg-stone-300"
                          />
                          <div className="relative">
                            <span className="absolute -left-5 top-[3px] h-2.5 w-2.5 rounded-full bg-emerald-500 ring-[3px] ring-emerald-100" />
                            <p className="truncate text-[13px] font-medium text-black" title={from}>
                              {from}
                            </p>
                          </div>
                          <div className="relative">
                            <span className="absolute -left-5 top-[3px] h-2.5 w-2.5 rounded-full bg-black ring-[3px] ring-neutral-200" />
                            <p className="truncate text-[13px] font-medium text-black" title={to}>
                              {to}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Fare + status */}
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <span
                          className={`font-caslon text-xl font-bold leading-none ${
                            cancelled ? "text-stone-400 line-through" : "text-black"
                          }`}
                        >
                          {trip.fare}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                            completed
                              ? "bg-emerald-50 text-emerald-700"
                              : cancelled
                              ? "bg-rose-50 text-rose-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          {completed ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : cancelled ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Clock className="h-3 w-3" />
                          )}
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-zinc-400">
                No ride found
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Vehicle & Documents Compliance */}
        <div className="lg:col-span-5 space-y-6" id="vehicle">
          {/* Vehicle Status Card */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <h3 className="font-caslon text-lg font-bold text-black">
                Vehicle Overview
              </h3>
              {verificationStatus ? (
                <span
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                    verificationStatus === "VERIFIED"
                      ? "bg-emerald-50 text-emerald-700"
                      : verificationStatus === "PENDING"
                      ? "bg-amber-50 text-amber-700"
                      : "bg-rose-50 text-rose-700"
                  }`}
                >
                  {verificationStatus}
                </span>
              ) : (
                <span className="text-zinc-400 font-semibold text-xs">-</span>
              )}
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Model</span>
                <span className="font-semibold text-black">
                  {[vehicle?.make, vehicle?.model].filter(Boolean).join(" ") || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Plate Number</span>
                <span className="font-semibold text-black uppercase font-mono">
                  {vehicle?.registrationNumber || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Vehicle Type</span>
                <span className="font-semibold text-black uppercase font-mono">
                  {vehicle?.vehicleType || "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Year</span>
                <span className="font-semibold text-black">
                  {vehicle?.year ? String(vehicle.year) : "-"}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Color</span>
                <span className="font-semibold text-black capitalize">
                  {vehicle?.color || "-"}
                </span>
              </div>
            </div>
          </div>

          {/* Verified Documents Checklist */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs" id="documents">
            <h3 className="font-caslon text-lg font-bold text-black mb-1">
              Documents &amp; Compliance
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              Statutory documents verified with Ridezy Trust &amp; Safety.
            </p>

            <div className="space-y-3">
              {documents.length > 0 ? (
                documents.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <div>
                        <span className="font-semibold text-zinc-900 block">
                          {doc.documentType === "DRIVING_LICENSE"
                            ? "Driving License"
                            : doc.documentType === "AADHAAR"
                            ? "Aadhaar Card"
                            : doc.documentType}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          {doc.documentNumber || "-"}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider ${
                        doc.verificationStatus === "VERIFIED"
                          ? "text-emerald-700 bg-emerald-50"
                          : doc.verificationStatus === "PENDING"
                          ? "text-amber-700 bg-amber-50"
                          : "text-rose-700 bg-rose-50"
                      }`}
                    >
                      {doc.verificationStatus || "-"}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-100 text-center text-xs text-zinc-400">
                  No documents uploaded yet
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom-Right Toast Notifications Container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-md transition-all duration-300 animate-in slide-in-from-bottom-3 ${
              toast.type === "success"
                ? "bg-gradient-to-r from-emerald-950/95 to-emerald-900/95 border-emerald-500/30 text-white"
                : toast.type === "error"
                ? "bg-gradient-to-r from-red-950/95 to-rose-900/95 border-red-500/30 text-white"
                : "bg-gradient-to-r from-zinc-950/95 to-zinc-900/95 border-zinc-700/50 text-white"
            }`}
          >
            {toast.type === "success" && (
              <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            )}
            {toast.type === "error" && (
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            )}
            <div className="flex-1 text-xs sm:text-sm font-medium leading-snug">
              {toast.message}
            </div>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
