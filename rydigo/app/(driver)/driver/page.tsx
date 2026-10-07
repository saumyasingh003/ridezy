"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
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
  FileText,
  AlertCircle,
  Power,
  ArrowRight,
  DollarSign,
  User,
  Edit2,
  Save,
  X,
  Check,
  CreditCard,
  Calendar,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface ToastItem {
  id: string;
  type: "success" | "error" | "info";
  message: string;
}

export default function DriverDashboardPage() {
  const [driverName, setDriverName] = useState("Partner");
  const [driverPhone, setDriverPhone] = useState("+91 98765 43210");
  const [isOnline, setIsOnline] = useState(true);

  // Profile State connected to GET /api/drivers/profile
  const [profile, setProfile] = useState<{
    name?: string;
    email?: string;
    phone?: string;
    licenseNumber?: string;
    verificationStatus?: string;
    dateOfBirth?: string;
    gender?: string;
  } | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editLicense, setEditLicense] = useState("");
  const [editGender, setEditGender] = useState("MALE");
  const [editDob, setEditDob] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);
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

  // 1. GET /api/drivers/profile
  const fetchDriverProfile = async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const res = await fetch(`${API_BASE}/drivers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        setProfile(json.data);
        if (json.data.name) setDriverName(json.data.name);
        if (json.data.phone) {
          setDriverPhone(json.data.phone);
          setEditPhone(json.data.phone.replace(/^\+91/, ""));
        }
        if (json.data.licenseNumber) {
          setEditLicense(json.data.licenseNumber);
        }
        if (json.data.gender) setEditGender(json.data.gender);
        if (json.data.dateOfBirth) setEditDob(json.data.dateOfBirth.slice(0, 10));
      }
    } catch {}
  };

  // 2. PATCH /api/drivers/profile
  const handleUpdateDriverProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const payload: Record<string, any> = {
        gender: editGender,
      };
      if (editPhone) {
        payload.phone = "+91" + editPhone.replace(/\D/g, "").slice(-10);
      }
      if (editDob) {
        payload.dateOfBirth = editDob;
      }
      if (editLicense) {
        payload.licenseNumber = editLicense.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);
      }

      const res = await fetch(`${API_BASE}/drivers/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success) {
        showToast(json.message || "Driver profile updated successfully.", "success");
        if (json.data) {
          setProfile(json.data);
          if (json.data.phone) setDriverPhone(json.data.phone);
          if (json.data.licenseNumber) {
            localStorage.setItem("userLicenseNumber", json.data.licenseNumber);
          }
        }
        setIsEditingProfile(false);
      } else {
        const errorMsg =
          json.errors?.[0]?.message || json.message || "Failed to update driver profile.";
        showToast(errorMsg, "error");
      }
    } catch {
      showToast("Cannot connect to server. Please try again.", "error");
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Simulated live ride state
  const [hasIncomingRide, setHasIncomingRide] = useState(true);
  const [activeRide, setActiveRide] = useState<null | {
    passenger: string;
    rating: string;
    fare: number;
    pickup: string;
    dropoff: string;
    distance: string;
    duration: string;
  }>(null);

  const [tripEarnings, setTripEarnings] = useState(2840);
  const [completedTripsCount, setCompletedTripsCount] = useState(9);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("userName");
      const storedPhone = localStorage.getItem("userPhone");
      const storedLicense = localStorage.getItem("userLicenseNumber");
      if (storedName) setDriverName(storedName);
      if (storedPhone) setDriverPhone(`+91 ${storedPhone}`);
      if (storedLicense) setEditLicense(storedLicense);
    }
    fetchDriverProfile();
  }, []);

  const handleAcceptRide = () => {
    setActiveRide({
      passenger: "Ananya Iyer",
      rating: "4.95",
      fare: 340,
      pickup: "100ft Rd, Indiranagar",
      dropoff: "5th Block, Koramangala",
      distance: "6.2 km",
      duration: "24 mins",
    });
    setHasIncomingRide(false);
  };

  const handleDeclineRide = () => {
    setHasIncomingRide(false);
  };

  const handleCompleteTrip = () => {
    if (activeRide) {
      setTripEarnings((prev) => prev + activeRide.fare);
      setCompletedTripsCount((prev) => prev + 1);
      setActiveRide(null);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Welcome & Duty Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-white border border-zinc-200 shadow-xs">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-black text-white">
              Driver Portal
            </span>
            <span className="text-xs text-zinc-500 font-medium">
              ID: RZ-DRV-4091
            </span>
          </div>
          <h1 className="font-caslon text-2xl sm:text-3xl lg:text-4xl font-bold text-black tracking-tight">
            Welcome back, {driverName}!
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Assigned Vehicle:{" "}
            <span className="font-semibold text-black">
              Toyota Innova Crysta
            </span>{" "}
            • Registration:{" "}
            <span className="font-semibold text-black">KA 01 MJ 4521</span>
          </p>
        </div>

        {/* Big Duty Status Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsOnline(!isOnline)}
            className={`flex items-center gap-3 px-5 py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer shadow-xs ${
              isOnline
                ? "bg-black text-white hover:bg-neutral-800"
                : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 border border-zinc-200"
            }`}
          >
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-400"
              }`}
            />
            <span>{isOnline ? "You are Online (Ready for rides)" : "You are Offline"}</span>
            <Power className="w-4 h-4 ml-1 opacity-70" />
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {/* Today's Earnings */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Today&apos;s Earnings
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-black">
              ₹
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-black font-caslon">
            ₹{tripEarnings.toLocaleString("en-IN")}
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>+16.4% from yesterday</span>
          </div>
        </div>

        {/* Completed Trips */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Completed Trips
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-black">
              <Car className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-black font-caslon">
            {completedTripsCount} Rides
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
            <Clock className="w-3.5 h-3.5" />
            <span>5 hrs 15 mins on duty</span>
          </div>
        </div>

        {/* Acceptance Rate */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Acceptance Rate
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-black">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-black font-caslon">
            97.8%
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs font-semibold text-emerald-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Top Tier Partner</span>
          </div>
        </div>

        {/* Driver Rating */}
        <div className="p-5 rounded-2xl bg-white border border-zinc-200 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Driver Rating
            </span>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-black">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-black font-caslon">
            4.94 ★
          </div>
          <div className="flex items-center gap-1.5 mt-2 text-xs text-zinc-500">
            <span>Based on 184 passenger reviews</span>
          </div>
        </div>
      </div>

      {/* Main Grid: Active/Incoming Dispatch (Left 60%) + Quick Info & Documents (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8" id="rides">
        {/* Left Column: Live Ride Dispatch & Current Trip */}
        <div className="lg:col-span-7 space-y-6">
          {/* Active Trip in Progress Card */}
          {activeRide ? (
            <div className="p-6 rounded-2xl border-2 border-black bg-white shadow-md">
              <div className="flex items-center justify-between pb-4 border-b border-zinc-100">
                <div className="flex items-center gap-2.5">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-black">
                    Trip In Progress
                  </span>
                </div>
                <span className="text-lg font-bold font-caslon text-black">
                  ₹{activeRide.fare}
                </span>
              </div>

              {/* Passenger Info */}
              <div className="flex items-center justify-between py-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black text-white flex items-center justify-center font-bold text-sm">
                    {activeRide.passenger.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-black text-sm">
                      {activeRide.passenger}
                    </h3>
                    <p className="text-xs text-zinc-500 flex items-center gap-1">
                      <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      <span>{activeRide.rating} • Passenger</span>
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                >
                  <Phone className="w-3.5 h-3.5" />
                  <span>Call</span>
                </button>
              </div>

              {/* Route */}
              <div className="space-y-3 py-3 border-t border-zinc-100">
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-black mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Pickup
                    </p>
                    <p className="text-sm font-semibold text-black">
                      {activeRide.pickup}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-emerald-600 mt-1.5 shrink-0" />
                  <div>
                    <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                      Destination
                    </p>
                    <p className="text-sm font-semibold text-black">
                      {activeRide.dropoff}
                    </p>
                  </div>
                </div>
              </div>

              {/* Complete Trip CTA */}
              <button
                type="button"
                onClick={handleCompleteTrip}
                className="w-full mt-4 flex items-center justify-center gap-2 py-3.5 rounded-xl bg-black text-white font-semibold text-sm hover:bg-neutral-800 transition-all cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Complete Trip & Collect ₹{activeRide.fare}</span>
              </button>
            </div>
          ) : hasIncomingRide ? (
            /* Incoming Ride Offer Card */
            <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-black">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
                  Incoming Ride Request
                </span>
                <span className="text-xs font-medium text-zinc-400">
                  Expires in 28s
                </span>
              </div>

              <div className="my-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-black font-caslon">
                    Ananya Iyer
                  </h3>
                  <p className="text-xs text-zinc-500">
                    ★ 4.95 • Payment: Cash / UPI
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-caslon text-black">
                    ₹340
                  </div>
                  <div className="text-xs text-zinc-500">Est. Earnings</div>
                </div>
              </div>

              {/* Trip Route Details */}
              <div className="bg-[#FAFAFA] p-4 rounded-xl border border-zinc-100 space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-black shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Pickup (1.4 km away • 4 min)
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-900">
                      100ft Rd, Indiranagar
                    </span>
                  </div>
                </div>
                <div className="flex items-start gap-2.5">
                  <Navigation className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider block">
                      Dropoff (6.2 km • 24 min trip)
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-zinc-900">
                      5th Block, Koramangala
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 mt-5">
                <button
                  type="button"
                  onClick={handleDeclineRide}
                  className="py-3 rounded-xl border border-zinc-200 text-xs sm:text-sm font-semibold text-zinc-700 hover:bg-zinc-50 transition-colors cursor-pointer"
                >
                  Decline
                </button>
                <button
                  type="button"
                  onClick={handleAcceptRide}
                  className="py-3 rounded-xl bg-black text-white text-xs sm:text-sm font-semibold hover:bg-neutral-800 transition-colors cursor-pointer shadow-md"
                >
                  Accept Ride
                </button>
              </div>
            </div>
          ) : (
            /* Standby Card */
            <div className="p-8 rounded-2xl border border-zinc-200 bg-white text-center">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center mx-auto mb-3 text-black">
                <Navigation className="w-5 h-5 animate-spin" />
              </div>
              <h3 className="font-caslon text-xl font-bold text-black">
                Searching for nearby rides...
              </h3>
              <p className="text-xs text-zinc-500 mt-1 max-w-sm mx-auto">
                You are currently in a high-demand zone. Keep your GPS active and remain available.
              </p>
              <button
                type="button"
                onClick={() => setHasIncomingRide(true)}
                className="mt-4 px-4 py-2 text-xs font-semibold rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 transition-colors cursor-pointer"
              >
                Simulate New Ride Request
              </button>
            </div>
          )}

          {/* Recent Completed Trips List */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-caslon text-lg font-bold text-black">
                Recent Trips Today
              </h3>
              <span className="text-xs font-semibold text-zinc-500">
                {completedTripsCount} Total Trips
              </span>
            </div>

            <div className="divide-y divide-zinc-100">
              {[
                {
                  id: "TRIP-8021",
                  passenger: "Rohan V.",
                  route: "MG Road → Indiranagar",
                  fare: "₹280",
                  time: "11:45 AM",
                },
                {
                  id: "TRIP-8020",
                  passenger: "Pooja Hegde",
                  route: "Koramangala → Whitefield",
                  fare: "₹520",
                  time: "10:15 AM",
                },
                {
                  id: "TRIP-8019",
                  passenger: "David K.",
                  route: "Airport T1 → HSR Layout",
                  fare: "₹890",
                  time: "08:30 AM",
                },
              ].map((trip) => (
                <div
                  key={trip.id}
                  className="py-3 flex items-center justify-between text-xs sm:text-sm"
                >
                  <div>
                    <p className="font-semibold text-black">{trip.route}</p>
                    <p className="text-zinc-400 text-xs">
                      {trip.passenger} • {trip.time}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="font-bold text-black">{trip.fare}</span>
                    <span className="block text-[10px] text-emerald-600 font-medium">
                      Completed ✓
                    </span>
                  </div>
                </div>
              ))}
            </div>
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
              <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700">
                Active & Approved
              </span>
            </div>

            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Model</span>
                <span className="font-semibold text-black">Toyota Innova Crysta</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Plate Number</span>
                <span className="font-semibold text-black">KA 01 MJ 4521</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Vehicle Type</span>
                <span className="font-semibold text-black">Ridezy XL (6 Seater)</span>
              </div>
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <span className="text-zinc-500">Fuel & Fitness</span>
                <span className="font-semibold text-emerald-600">Compliant (2027)</span>
              </div>
            </div>
          </div>

          {/* Verified Documents Checklist */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs" id="documents">
            <h3 className="font-caslon text-lg font-bold text-black mb-1">
              Documents & Compliance
            </h3>
            <p className="text-xs text-zinc-500 mb-4">
              All statutory documents are verified by Ridezy Trust & Safety.
            </p>

            <div className="space-y-3">
              {[
                { name: "Commercial Driving License", status: "Verified", date: "Expires 2031" },
                { name: "Vehicle RC (Registration)", status: "Verified", date: "Valid" },
                { name: "Comprehensive Insurance", status: "Verified", date: "Expires Dec 2026" },
                { name: "City Commercial Permit", status: "Verified", date: "Valid" },
              ].map((doc, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-xl bg-zinc-50 border border-zinc-100 text-xs"
                >
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-semibold text-zinc-900 block">
                        {doc.name}
                      </span>
                      <span className="text-[11px] text-zinc-500">
                        {doc.date}
                      </span>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[10px]">
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Driver Profile & Verification Card (GET & PATCH /api/drivers/profile) */}
          <div className="p-6 rounded-2xl border border-zinc-200 bg-white shadow-xs" id="profile">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
              <div>
                <h3 className="font-caslon text-lg font-bold text-black">
                  Driver Profile &amp; License
                </h3>
                <p className="text-xs text-zinc-500">
                  Registered details with Ridezy Driver Partner Network.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingProfile(!isEditingProfile)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 text-xs font-semibold hover:bg-zinc-50 transition-colors cursor-pointer"
              >
                {isEditingProfile ? (
                  <>
                    <X className="w-3.5 h-3.5" />
                    <span>Cancel</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit</span>
                  </>
                )}
              </button>
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleUpdateDriverProfile} className="mt-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Driver licence no
                  </label>
                  <div className="relative rounded-xl">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-zinc-400">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      maxLength={16}
                      value={editLicense}
                      onChange={(e) =>
                        setEditLicense(
                          e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16)
                        )
                      }
                      placeholder="DL1420110012345"
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-9 pr-3 py-2 text-xs font-mono tracking-wider uppercase text-black focus:border-black focus:bg-white focus:outline-none"
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 block mt-0.5">
                    15–16 alphanumeric characters. Changing this resets verification to PENDING.
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <div className="relative rounded-xl">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-xs font-semibold text-zinc-500">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                      placeholder="9876543210"
                      className="block w-full rounded-xl border border-zinc-200 bg-zinc-50 pl-10 pr-3 py-2 text-xs text-black focus:border-black focus:bg-white focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                      Gender
                    </label>
                    <select
                      value={editGender}
                      onChange={(e) => setEditGender(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-black focus:border-black focus:outline-none"
                    >
                      <option value="MALE">Male</option>
                      <option value="FEMALE">Female</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-zinc-700 uppercase tracking-wider mb-1">
                      Date of Birth
                    </label>
                    <input
                      type="date"
                      value={editDob}
                      onChange={(e) => setEditDob(e.target.value)}
                      className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-xs text-black focus:border-black focus:outline-none"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 hover:bg-zinc-100 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingProfile}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-black text-white text-xs font-semibold hover:bg-neutral-800 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>{isSavingProfile ? "Saving..." : "Save Profile"}</span>
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-zinc-500">Driver licence no</span>
                  <span className="font-mono font-semibold text-black tracking-wider uppercase">
                    {profile?.licenseNumber || editLicense || "DL1420110012345"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-zinc-500">Verification</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800">
                    {profile?.verificationStatus || "VERIFIED"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-zinc-500">Phone</span>
                  <span className="font-semibold text-black">{profile?.phone || driverPhone}</span>
                </div>
                {profile?.dateOfBirth && (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-zinc-500">Date of Birth</span>
                    <span className="font-semibold text-black">{profile.dateOfBirth.slice(0, 10)}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-zinc-100 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>API: <code>/api/drivers/profile</code></span>
                  <span className="text-emerald-700 font-semibold">Active Profile ✓</span>
                </div>
              </div>
            )}
          </div>

          {/* Help & Support Banner */}
          <div className="p-5 rounded-2xl bg-black text-white">
            <div className="flex items-center gap-2 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
                24/7 Driver Support
              </span>
            </div>
            <p className="text-xs text-zinc-400 leading-relaxed mb-3">
              Need assistance on the road or have fare discrepancies? Contact the dedicated driver hotline.
            </p>
            <button
              type="button"
              className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-semibold hover:bg-zinc-100 transition-colors cursor-pointer"
            >
              Call Partner Helpline (1800-RIDEZY)
            </button>
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
