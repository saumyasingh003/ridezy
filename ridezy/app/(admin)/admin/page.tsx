"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Users,
  Car,
  Star,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ChevronRight,
  User,
} from "lucide-react";
import { API_BASE } from "@/lib/config";


interface AdminStats {
  totalCustomers: number;
  totalDrivers: number;
  pendingDrivers: number;
  verifiedDrivers: number;
  totalRides: number;
  activeRides?: number;
  /** Average of all riders' ratings (0 when none yet) */
  averageRating: number;
  totalRatings?: number;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalCustomers: 0,
    totalDrivers: 0,
    pendingDrivers: 0,
    verifiedDrivers: 0,
    totalRides: 0,
    averageRating: 0,
  });
  const [pendingDrivers, setPendingDrivers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [adminName, setAdminName] = useState("Saumya Singh");
  const [adminProfile, setAdminProfile] = useState({
    name: "Saumya Singh",
    email: "saumyasingh98982@gmail.com",
    phone: "+91 98765 43210",
    role: "ADMIN",
    isEmailVerified: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const [analyticsSnapshot, setAnalyticsSnapshot] = useState<{
    revenue?: { amount: number; currency: string };
    totalRevenue?: number;
    totalRides?: number;
    completedRides?: number;
    activeDrivers?: number;
  } | null>(null);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const [statsRes, pendingRes, analyticsRes] = await Promise.all([
          fetch(`${API_BASE}/admin/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/admin/drivers/pending-verification?limit=5`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/admin/analytics`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const statsJson = await statsRes.json().catch(() => ({}));
        if (statsRes.ok && statsJson.success && statsJson.data) {
          setStats(statsJson.data);
        }

        const pendingJson = await pendingRes.json().catch(() => ({}));
        if (pendingRes.ok && pendingJson.success && Array.isArray(pendingJson.data?.drivers)) {
          setPendingDrivers(pendingJson.data.drivers);
        }

        const analyticsJson = await analyticsRes.json().catch(() => ({}));
        if (analyticsRes.ok && analyticsJson.success && analyticsJson.data) {
          setAnalyticsSnapshot(analyticsJson.data);
        }
      }
    } catch {
      // Keep state as initialized
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const storedName = localStorage.getItem("userName");
      const storedEmail = localStorage.getItem("userEmail");
      const storedUser = localStorage.getItem("user");
      let parsedUser: any = null;
      if (storedUser) {
        try {
          parsedUser = JSON.parse(storedUser);
        } catch {}
      }

      setAdminProfile((prev) => ({
        ...prev,
        name: storedName || parsedUser?.name || prev.name,
        email: storedEmail || parsedUser?.email || prev.email,
        phone: parsedUser?.phone || prev.phone,
        role: parsedUser?.role || localStorage.getItem("userRole") || prev.role,
      }));

      if (storedName || parsedUser?.name) {
        setAdminName(storedName || parsedUser?.name);
      }

      const token = localStorage.getItem("token");
      if (token) {
        fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        })
          .then((res) => res.json())
          .then((json) => {
            if (json.success && json.data) {
              setAdminProfile((prev) => ({
                ...prev,
                name: json.data.name || prev.name,
                email: json.data.email || prev.email,
                phone: json.data.phone || prev.phone,
                role: json.data.role || prev.role,
                isEmailVerified: json.data.isEmailVerified ?? prev.isEmailVerified,
              }));
              if (json.data.name) setAdminName(json.data.name);
            }
          })
          .catch(() => {});
      }
    }
    fetchStats();
  }, []);

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 rounded-xl bg-black px-4 py-2.5 text-xs text-white shadow-xl animate-in fade-in">
          {toastMessage}
        </div>
      )}

      {/* 1. TOP HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[190px] sm:h-[210px] lg:h-[225px] flex items-center w-full shrink-0">
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <Image
            src="/admin-banner.jpg"
            alt="Admin Platform Overview Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-5 flex flex-col justify-center">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Platform Overview &amp; Control
            </span>
            <h1 className="font-caslon text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Welcome back, {adminName}
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Here is your live Ridezy platform overview. Manage registered customers, inspect and approve driver partners, and monitor rider ratings in real time.
            </p>
          </div>
        </div>
      </div>

      {/* Platform Analytics Snapshot Strip (GET /api/admin/analytics) */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 px-4 py-3 sm:px-5 sm:py-3.5 bg-white border border-[#EDEDE8] rounded-2xl shadow-xs">
        <div className="flex flex-wrap items-center gap-3 sm:gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">Live Telemetry:</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">Platform Revenue:</span>
            <span className="font-bold text-stone-900 font-mono">
              ₹{(analyticsSnapshot?.revenue?.amount ?? analyticsSnapshot?.totalRevenue ?? 0).toLocaleString("en-IN")}
            </span>
          </div>
          <div className="hidden sm:inline text-stone-300">|</div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">Total Rides:</span>
            <span className="font-bold text-stone-900 font-mono">
              {(analyticsSnapshot?.totalRides ?? stats.totalRides ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="hidden sm:inline text-stone-300">|</div>
          <div className="flex items-center gap-1.5">
            <span className="text-stone-500">Active Fleet:</span>
            <span className="font-bold text-emerald-600 font-mono">
              {(analyticsSnapshot?.activeDrivers ?? 0).toLocaleString()} on-duty
            </span>
          </div>
        </div>
        <Link
          href="/admin/analytics"
          className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors shadow-2xs shrink-0"
        >
          <span>Deep Analytics</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* 2. Key Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Metric 1: Total Customers */}
        <Link
          href="/admin/customer"
          className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Customers
            </span>
            <div className="w-6 h-6 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/60">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {stats.totalCustomers}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <span className="text-emerald-600 font-semibold inline-flex items-center gap-0.5">
                <TrendingUp className="w-3 h-3" /> 100%
              </span>
              <span>active riders</span>
            </p>
          </div>
        </Link>

        {/* Metric 2: Total Drivers */}
        <Link
          href="/admin/driver"
          className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Total Drivers
            </span>
            <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100/60">
              <Car className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {stats.totalDrivers}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span>{stats.verifiedDrivers} verified partners</span>
            </p>
          </div>
        </Link>

        {/* Metric 3: Pending Approval */}
        <Link
          href="/admin/driver"
          className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Pending Approval
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100/60">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2">
            <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
              {stats.pendingDrivers}
            </p>
            <p className="text-[11px] text-amber-600 font-medium mt-1">
              Drivers awaiting check
            </p>
          </div>
        </Link>

        {/* Metric 4: Average Rating */}
        <Link
          href="/admin/rating-and-review"
          className="rounded-2xl bg-white border border-[#EDEDE8] p-3.5 sm:p-4 shadow-2xs hover:border-black/20 transition-colors flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
              Platform Rating
            </span>
            <div className="w-6 h-6 rounded-lg bg-amber-50 text-amber-500 flex items-center justify-center border border-amber-100/60">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="mt-2">
            <div className="flex items-baseline gap-1.5">
              <p className="font-caslon text-2xl sm:text-[26px] font-bold text-[#111111] leading-none">
                {stats.totalRatings ? stats.averageRating.toFixed(1) : "—"}
              </p>
              <span className="text-[11px] font-bold text-stone-400">/ 5.0</span>
            </div>
            <p className="text-[11px] text-stone-500 mt-1">
              {stats.totalRatings
                ? `From ${stats.totalRatings} rider ${stats.totalRatings === 1 ? "rating" : "ratings"}`
                : "No ratings yet"}
            </p>
          </div>
        </Link>
      </div>

      {/* 3. Quick Action Overview: Verification Queue & System Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Driver Verification Queue (GET /api/admin/drivers/pending-verification) */}
        <div className="rounded-3xl bg-white border border-[#EDEDE8] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#F0EFEA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-caslon text-lg font-bold text-[#111111]">
                    Pending Verification
                  </h3>
                  <p className="text-xs text-stone-500">
                    {pendingDrivers.length} waiting for approval
                  </p>
                </div>
              </div>
              <Link
                href="/admin/driver"
                className="text-xs font-bold text-black hover:underline"
              >
                View All &rarr;
              </Link>
            </div>

            <div className="mt-4 space-y-3">
              {pendingDrivers.length === 0 ? (
                <p className="text-xs text-stone-400 py-6 text-center">
                  No drivers waiting for verification.
                </p>
              ) : (
                pendingDrivers.map((driver) => {
                  const driverId = driver.id || driver._id;
                  const dName = driver.user?.name || driver.name || "Driver Partner";
                  const initial = dName.charAt(0).toUpperCase();

                  return (
                    <Link
                      key={driverId}
                      href={`/admin/driver/${driverId}`}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-stone-50 border border-stone-200/60 hover:bg-stone-100/80 hover:border-stone-300 transition-all group cursor-pointer"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 shrink-0 rounded-full bg-black text-white flex items-center justify-center text-xs font-bold font-caslon">
                          {initial}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-900 group-hover:underline truncate">
                            {dName}
                          </p>
                          <p className="text-[11px] text-stone-500 font-mono truncate">
                            DL: {driver.licenseNumber || "Pending"}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0 ml-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
                          PENDING
                        </span>
                        <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-black group-hover:translate-x-0.5 transition-all" />
                      </div>
                    </Link>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Administrator Profile Personal Data */}
        <div className="rounded-3xl bg-white border border-[#EDEDE8] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-[#F0EFEA]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center border border-sky-100/80">
                  <User className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-caslon text-lg font-bold text-[#111111]">
                    Administrator Profile
                  </h3>
                  <p className="text-xs text-stone-500">Personal &amp; Security Data</p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Active
              </span>
            </div>

            <div className="mt-4 space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Full Name</span>
                <span className="font-semibold text-stone-900">{adminProfile.name}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Email Address</span>
                <span className="font-semibold text-stone-900 font-mono text-[11px]">{adminProfile.email}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Phone Number</span>
                <span className="font-semibold text-stone-900 font-mono text-[11px]">
                  {adminProfile.phone || "+91 98765 43210"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Platform Role</span>
                <span className="font-semibold text-stone-900">
                  {adminProfile.role || "ADMIN"}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-stone-100">
                <span className="text-stone-500 font-medium">Account Status</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Verified &amp; Active</span>
                </span>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-stone-500 font-medium">Access Level</span>
                <span className="font-semibold text-stone-900">Master Platform Superuser</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
