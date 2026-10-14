"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  TrendingUp,
  DollarSign,
  Car,
  Users,
  CheckCircle2,
  XCircle,
  Calendar,
  RotateCcw,
  Activity,
  ArrowUpRight,
  ShieldCheck,
  Percent,
} from "lucide-react";
import CustomDateRangePicker from "@/components/admin/CustomDateRangePicker";

const API_BASE = "http://localhost:5000/api";

interface AnalyticsData {
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  activeDrivers: number;
  totalDrivers: number;
  totalPassengers: number;
  totalRevenue?: number;
  currency?: string;
  revenue: {
    amount: number;
    currency: string;
  };
  timeframe: {
    from: string;
    to: string;
  };
}

const PRESET_RANGES = [
  { label: "Last 7 Days", days: 7 },
  { label: "Last 30 Days", days: 30 },
  { label: "Last 90 Days", days: 90 },
  { label: "Custom Range", days: -1 },
];

export default function AdminAnalyticsPage() {
  const [selectedPreset, setSelectedPreset] = useState("Last 30 Days");
  const [customFrom, setCustomFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [customTo, setCustomTo] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fetchAnalytics = async (fromDate?: string, toDate?: string) => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        setIsLoading(false);
        return;
      }

      let queryParams = "";
      if (fromDate && toDate) {
        queryParams = `?from=${encodeURIComponent(fromDate)}&to=${encodeURIComponent(toDate)}`;
      }

      const res = await fetch(`${API_BASE}/admin/analytics${queryParams}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok && json.success && json.data) {
        setAnalytics(json.data);
      } else {
        setErrorMsg(json.message || "Failed to load platform analytics.");
      }
    } catch {
      setErrorMsg("Unable to reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedPreset === "Custom Range") {
      if (customFrom && customTo) {
        fetchAnalytics(customFrom, customTo);
      }
    } else {
      const preset = PRESET_RANGES.find((p) => p.label === selectedPreset);
      if (preset && preset.days > 0) {
        const fromD = new Date();
        fromD.setDate(fromD.getDate() - preset.days);
        const fromStr = fromD.toISOString().split("T")[0];
        const toStr = new Date().toISOString().split("T")[0];
        fetchAnalytics(fromStr, toStr);
      } else {
        fetchAnalytics();
      }
    }
  }, [selectedPreset]);

  const revenueAmount = analytics?.revenue?.amount ?? analytics?.totalRevenue ?? 0;
  const totalRides = analytics?.totalRides ?? 0;
  const completedRides = analytics?.completedRides ?? 0;
  const cancelledRides = analytics?.cancelledRides ?? 0;
  const completionRate = totalRides > 0 ? Math.round((completedRides / totalRides) * 100) : 0;
  const cancellationRate = totalRides > 0 ? Math.round((cancelledRides / totalRides) * 100) : 0;

  const activeDrivers = analytics?.activeDrivers ?? 0;
  const totalDrivers = analytics?.totalDrivers ?? 0;
  const driverUtilization = totalDrivers > 0 ? Math.round((activeDrivers / totalDrivers) * 100) : 0;

  const avgFarePerRide = completedRides > 0 ? Math.round(revenueAmount / completedRides) : 0;

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. TOP HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[190px] sm:h-[210px] lg:h-[225px] flex items-center w-full shrink-0">
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <Image
            src="/admin-banner.jpg"
            alt="Platform Analytics Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-5 flex flex-col justify-center">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Performance &amp; Business Intelligence
            </span>
            <h1 className="font-caslon text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Platform Analytics
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Comprehensive real-time telemetry across platform revenue, ride completions, fleet availability, and passenger adoption.
            </p>
          </div>
        </div>
      </div>

      {/* 2. TIMEFRAME & CONTROLS BAR */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 bg-white p-3.5 sm:p-4 rounded-2xl border border-[#EDEDE8] shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {PRESET_RANGES.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => setSelectedPreset(preset.label)}
              className={`px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-colors cursor-pointer border ${
                selectedPreset === preset.label
                  ? "bg-black text-white border-black shadow-xs"
                  : "bg-white text-stone-700 hover:text-black hover:bg-stone-50 border-stone-200"
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {selectedPreset === "Custom Range" ? (
          <CustomDateRangePicker
            fromDate={customFrom}
            toDate={customTo}
            onApply={(from, to) => {
              setCustomFrom(from);
              setCustomTo(to);
              fetchAnalytics(from, to);
            }}
          />
        ) : (
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-stone-500">
            {analytics?.timeframe && (
              <div className="flex items-center gap-1.5 font-mono text-[11px] bg-stone-50 px-2.5 py-1.5 rounded-lg border border-[#EDEDE8] text-stone-700">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>
                  {new Date(analytics.timeframe.from).toLocaleDateString()} —{" "}
                  {new Date(analytics.timeframe.to).toLocaleDateString()}
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (selectedPreset === "Custom Range") {
                  fetchAnalytics(customFrom, customTo);
                } else {
                  const preset = PRESET_RANGES.find((p) => p.label === selectedPreset);
                  if (preset && preset.days > 0) {
                    const fromD = new Date();
                    fromD.setDate(fromD.getDate() - preset.days);
                    fetchAnalytics(fromD.toISOString().split("T")[0], new Date().toISOString().split("T")[0]);
                  } else {
                    fetchAnalytics();
                  }
                }
              }}
              title="Refresh Analytics"
              className="p-2 rounded-lg border border-stone-200 bg-white text-stone-700 hover:text-black hover:bg-stone-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-stone-100 border border-stone-300 text-stone-800 text-xs font-medium">
          {errorMsg}
        </div>
      )}

      {/* 3. KEY METRICS TILES */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
        {/* Metric 1: Platform Revenue */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Revenue
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-900 border border-stone-200/80 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="font-caslon text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              {isLoading ? "..." : `₹${revenueAmount.toLocaleString("en-IN")}`}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <span className="text-stone-900 font-semibold">Completed Payments</span>
              <span>in timeframe</span>
            </p>
          </div>
        </div>

        {/* Metric 2: Total Rides */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Total Ride Volume
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-900 border border-stone-200/80 flex items-center justify-center">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="font-caslon text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              {isLoading ? "..." : totalRides.toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1.5">
              <span className="text-stone-900 font-semibold">{completionRate}% Completed</span>
              <span>·</span>
              <span className="text-stone-500 font-medium">{cancellationRate}% Cancelled</span>
            </p>
          </div>
        </div>

        {/* Metric 3: Active Fleet */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Active Driver Fleet
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-900 border border-stone-200/80 flex items-center justify-center">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="font-caslon text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              {isLoading ? "..." : activeDrivers.toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <span className="text-stone-900 font-medium">Out of {totalDrivers} verified drivers</span>
              <span>({driverUtilization}%)</span>
            </p>
          </div>
        </div>

        {/* Metric 4: Passenger Base */}
        <div className="bg-white p-5 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
              Registered Passengers
            </span>
            <div className="w-8 h-8 rounded-lg bg-stone-100 text-stone-900 border border-stone-200/80 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="font-caslon text-2xl sm:text-3xl font-bold text-stone-900 tracking-tight">
              {isLoading ? "..." : (analytics?.totalPassengers ?? 0).toLocaleString()}
            </p>
            <p className="text-[11px] text-stone-500 mt-1 flex items-center gap-1">
              <span className="text-stone-900 font-medium">Platform users</span>
              <span>eligible to book</span>
            </p>
          </div>
        </div>
      </div>

      {/* 4. PERFORMANCE BREAKDOWN DETAILS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left Card: Ride Status Breakdown */}
        <div className="bg-white p-6 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#EDEDE8]">
              <div>
                <h2 className="font-caslon text-lg font-bold text-stone-900">
                  Ride Fulfillment Dynamics
                </h2>
                <p className="text-xs text-stone-500">
                  Breakdown of requested journeys in the selected timeframe
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-stone-100 border border-stone-200 text-stone-800 font-mono">
                {totalRides} Total Rides
              </span>
            </div>

            {/* Visual Bar */}
            <div className="mt-5 space-y-2">
              <div className="h-3 w-full bg-stone-100 border border-stone-200/80 rounded-lg overflow-hidden flex">
                <div
                  style={{ width: `${completionRate}%` }}
                  className="bg-black h-full transition-all duration-500"
                  title={`Completed: ${completionRate}%`}
                />
                <div
                  style={{ width: `${cancellationRate}%` }}
                  className="bg-stone-400 h-full transition-all duration-500"
                  title={`Cancelled: ${cancellationRate}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-black inline-block" />
                  Completed ({completionRate}%)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-stone-400 inline-block" />
                  Cancelled ({cancellationRate}%)
                </span>
              </div>
            </div>

            {/* Metrics List */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/80 border border-[#EDEDE8]">
                <div className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-stone-900" />
                  <span className="text-xs font-semibold text-stone-800">Completed Rides</span>
                </div>
                <span className="text-xs font-bold text-stone-900 font-mono">
                  {completedRides.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/80 border border-[#EDEDE8]">
                <div className="flex items-center gap-2.5">
                  <XCircle className="w-4 h-4 text-stone-500" />
                  <span className="text-xs font-semibold text-stone-800">Cancelled Rides</span>
                </div>
                <span className="text-xs font-bold text-stone-900 font-mono">
                  {cancelledRides.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/80 border border-[#EDEDE8]">
                <div className="flex items-center gap-2.5">
                  <TrendingUp className="w-4 h-4 text-stone-900" />
                  <span className="text-xs font-semibold text-stone-800">Average Fare per Ride</span>
                </div>
                <span className="text-xs font-bold text-stone-900 font-mono">
                  ₹{avgFarePerRide.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Card: Driver Fleet Health & Utilization */}
        <div className="bg-white p-6 rounded-2xl sm:rounded-3xl border border-[#EDEDE8] shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[#EDEDE8]">
              <div>
                <h2 className="font-caslon text-lg font-bold text-stone-900">
                  Fleet Utilization &amp; Coverage
                </h2>
                <p className="text-xs text-stone-500">
                  Driver supply and active on-road availability
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-stone-100 border border-stone-200 text-stone-800 font-mono">
                {totalDrivers} Total Drivers
              </span>
            </div>

            {/* Visual Meter */}
            <div className="mt-5 space-y-2">
              <div className="h-3 w-full bg-stone-100 border border-stone-200/80 rounded-lg overflow-hidden flex">
                <div
                  style={{ width: `${driverUtilization}%` }}
                  className="bg-black h-full transition-all duration-500"
                  title={`Active: ${driverUtilization}%`}
                />
              </div>
              <div className="flex items-center justify-between text-[11px] text-stone-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-sm bg-black inline-block" />
                  Active / On-Duty ({driverUtilization}%)
                </span>
                <span className="text-stone-500">{totalDrivers - activeDrivers} Inactive / Offline</span>
              </div>
            </div>

            {/* Details */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/80 border border-[#EDEDE8]">
                <div className="flex items-center gap-2.5">
                  <Car className="w-4 h-4 text-stone-900" />
                  <span className="text-xs font-semibold text-stone-800">Available / Busy Drivers</span>
                </div>
                <span className="text-xs font-bold text-stone-900 font-mono">
                  {activeDrivers.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/80 border border-[#EDEDE8]">
                <div className="flex items-center gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-stone-900" />
                  <span className="text-xs font-semibold text-stone-800">Total Registered Fleet</span>
                </div>
                <span className="text-xs font-bold text-stone-900 font-mono">
                  {totalDrivers.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-stone-50/80 border border-[#EDEDE8]">
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-stone-900" />
                  <span className="text-xs font-semibold text-stone-800">Passenger-to-Driver Ratio</span>
                </div>
                <span className="text-xs font-bold text-stone-900 font-mono">
                  {totalDrivers > 0 ? (Math.round((analytics?.totalPassengers ?? 0) / totalDrivers * 10) / 10) : 0} : 1
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
