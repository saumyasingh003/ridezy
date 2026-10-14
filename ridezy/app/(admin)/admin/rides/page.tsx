"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Navigation,
  Search,
  ChevronDown,
  RotateCcw,
  Clock,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Car,
  User,
  Phone,
  IndianRupee,
  Activity,
  ArrowRight,
  Shield,
  Radio,
  Check,
} from "lucide-react";
import { API_BASE } from "@/lib/config";


interface DropdownOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Statuses" },
  { value: "SEARCHING", label: "Searching Driver" },
  { value: "DRIVER_ASSIGNED", label: "Driver Assigned" },
  { value: "DRIVER_ARRIVING", label: "Driver Arriving" },
  { value: "DRIVER_ARRIVED", label: "Driver Arrived" },
  { value: "RIDE_STARTED", label: "In Progress" },
  { value: "RIDE_COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
];

const VEHICLE_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Vehicles" },
  { value: "CAB", label: "Cab / Taxi" },
  { value: "AUTO", label: "Auto Rickshaw" },
  { value: "BIKE", label: "Bike / Moto" },
];

function CustomDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== "ALL";

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel || selectedOption.label}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors cursor-pointer select-none bg-white ${
          isFiltered
            ? "border border-stone-400 text-stone-900 bg-stone-50/60"
            : "border border-[#EDEDE8] text-stone-600 hover:text-stone-900 hover:border-stone-300"
        } ${isOpen ? "border-stone-400 ring-1 ring-stone-200" : ""}`}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 transition-transform ${
            isOpen ? "rotate-180 text-stone-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[#EDEDE8] bg-white p-1.5 shadow-xl shadow-stone-900/10 z-50 animate-in fade-in zoom-in-95">
          {options.map((opt) => {
            const isSelected = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium text-left cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-stone-900 text-white shadow-2xs font-semibold"
                    : "text-stone-700 hover:bg-stone-100 hover:text-stone-900"
                }`}
              >
                <span>{opt.label}</span>
                {isSelected && <Check className="w-3.5 h-3.5 text-white shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AdminRide {
  id: string;
  status: string;
  pickup: { address: string; latitude: number; longitude: number };
  destination: { address: string; latitude: number; longitude: number };
  vehicleType: string;
  distanceKm: number;
  estimatedDurationMinutes: number;
  estimatedFare: number;
  finalFare: number | null;
  currency: string;
  createdAt: string;
  assignedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  passenger?: { id: string; name: string; phone: string | null; email: string } | null;
  driver?: { id: string; name: string; phone: string | null; email: string } | null;
}

export default function AdminRidesPage() {
  const [rides, setRides] = useState<AdminRide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [vehicleFilter, setVehicleFilter] = useState("ALL");
  const [activeOnlyMode, setActiveOnlyMode] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchRides = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) return;

      const endpoint = activeOnlyMode
        ? `${API_BASE}/admin/rides/active?page=${page}&limit=20`
        : `${API_BASE}/admin/rides?page=${page}&limit=20${
            statusFilter !== "ALL" ? `&status=${statusFilter}` : ""
          }`;

      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.success && json.data) {
        setRides(json.data.rides || []);
        if (json.data.pagination) {
          setTotalPages(json.data.pagination.pages || 1);
          setTotalCount(json.data.pagination.total || 0);
        }
      }
    } catch {
      // Keep state
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRides();
  }, [page, statusFilter, activeOnlyMode]);

  const filteredRides = rides.filter((r) => {
    if (vehicleFilter !== "ALL" && r.vehicleType?.toUpperCase() !== vehicleFilter) {
      return false;
    }
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const idMatch = r.id.toLowerCase().includes(q);
    const passMatch =
      r.passenger?.name?.toLowerCase().includes(q) ||
      r.passenger?.email?.toLowerCase().includes(q) ||
      r.passenger?.phone?.includes(q);
    const driverMatch =
      r.driver?.name?.toLowerCase().includes(q) ||
      r.driver?.email?.toLowerCase().includes(q) ||
      r.driver?.phone?.includes(q);
    const routeMatch =
      r.pickup?.address?.toLowerCase().includes(q) ||
      r.destination?.address?.toLowerCase().includes(q);

    return idMatch || passMatch || driverMatch || routeMatch;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "SEARCHING":
        return (
          <span className="text-xs font-bold uppercase text-amber-600">
            SEARCHING
          </span>
        );
      case "DRIVER_ASSIGNED":
        return (
          <span className="text-xs font-bold uppercase text-sky-600">
            ASSIGNED
          </span>
        );
      case "DRIVER_ARRIVING":
        return (
          <span className="text-xs font-bold uppercase text-indigo-600">
            ARRIVING
          </span>
        );
      case "DRIVER_ARRIVED":
        return (
          <span className="text-xs font-bold uppercase text-indigo-600">
            ARRIVED
          </span>
        );
      case "RIDE_STARTED":
        return (
          <span className="text-xs font-bold uppercase text-sky-600">
            IN PROGRESS
          </span>
        );
      case "RIDE_COMPLETED":
        return (
          <span className="text-xs font-bold uppercase text-emerald-600">
            COMPLETED
          </span>
        );
      case "CANCELLED":
        return (
          <span className="text-xs font-bold uppercase text-rose-600">
            CANCELLED
          </span>
        );
      default:
        return (
          <span className="text-xs font-bold uppercase text-stone-600">
            {status.replace(/_/g, " ")}
          </span>
        );
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. TOP HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[190px] sm:h-[210px] lg:h-[225px] flex items-center w-full shrink-0">
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <Image
            src="/admin-banner.jpg"
            alt="Ride Dispatch Operations Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-5 flex flex-col justify-center">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Operations &amp; Dispatch
            </span>
            <h1 className="font-caslon text-2xl sm:text-3xl lg:text-[34px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Live Rides &amp; Trip Logs
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Track live trip dispatch in real time, monitor passenger pickup &amp; drop routes, and review platform fare calculation logs.
            </p>
          </div>
        </div>
      </div>

      {/* 2. MODE SWITCH & FILTERS BAR */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Active Toggle Tabs */}
        <div className="inline-flex p-1 bg-stone-100 rounded-xl border border-stone-200/80 self-start">
          <button
            type="button"
            onClick={() => {
              setActiveOnlyMode(false);
              setPage(1);
            }}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              !activeOnlyMode
                ? "bg-white text-stone-900 shadow-xs"
                : "text-stone-600 hover:text-stone-900"
            }`}
          >
            All Trip History
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveOnlyMode(true);
              setPage(1);
            }}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeOnlyMode
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-stone-600 hover:text-emerald-700"
            }`}
          >
            <Radio className="w-3 h-3 animate-pulse" />
            <span>Active In-Progress</span>
          </button>
        </div>

        {/* Search & Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Input */}
          <div className="relative min-w-[200px] sm:min-w-[260px] flex-1 sm:flex-none">
            <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, rider, driver, address..."
              className="w-full pl-9 pr-3 py-2 rounded-xl text-xs sm:text-sm border border-[#EDEDE8] bg-white placeholder:text-stone-400 focus:outline-hidden focus:border-stone-400 transition-colors"
            />
          </div>

          {!activeOnlyMode && (
            <CustomDropdown
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              ariaLabel="Filter by Status"
            />
          )}

          <CustomDropdown
            value={vehicleFilter}
            onChange={setVehicleFilter}
            options={VEHICLE_OPTIONS}
            ariaLabel="Filter by Vehicle Type"
          />

          <button
            type="button"
            onClick={fetchRides}
            title="Refresh rides"
            className="p-2.5 rounded-xl border border-[#EDEDE8] bg-white text-stone-600 hover:text-stone-900 hover:bg-stone-50 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 3. RIDES TABLE */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDE8] bg-[#FBFBFA] text-[11px] font-bold uppercase tracking-wider text-[#7A7A72]">
                <th className="py-4 px-5 sm:px-6">Ride Details</th>
                <th className="py-4 px-4 sm:px-5">Passenger</th>
                <th className="py-4 px-4 sm:px-5">Driver Partner</th>
                <th className="py-4 px-4 sm:px-5">Route &amp; Distance</th>
                <th className="py-4 px-4 sm:px-5 text-right">Fare</th>
                <th className="py-4 px-5 sm:px-6 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                    Loading ride dispatch records...
                  </td>
                </tr>
              ) : filteredRides.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-stone-400 text-xs">
                    No rides found matching the selected criteria.
                  </td>
                </tr>
              ) : (
                filteredRides.map((ride) => {
                  const fareAmount = ride.finalFare ?? ride.estimatedFare ?? 0;
                  return (
                    <tr key={ride.id} className="hover:bg-[#F9F9F6] transition-colors">
                      {/* Ride ID, Vehicle, Time */}
                      <td className="py-4 px-5 sm:px-6">
                        <div className="space-y-1">
                          <span className="font-mono text-xs font-bold text-stone-900">
                            #{ride.id.slice(-6).toUpperCase()}
                          </span>
                          <div className="flex items-center gap-1.5 text-[11px] text-stone-500">
                            <Car className="w-3 h-3 text-stone-400" />
                            <span className="font-semibold text-stone-700">
                              {ride.vehicleType}
                            </span>
                            <span>·</span>
                            <span>{new Date(ride.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                          <span className="text-[10px] text-stone-400 block">
                            {new Date(ride.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Passenger */}
                      <td className="py-4 px-4 sm:px-5">
                        {ride.passenger ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-stone-900 text-xs">
                              {ride.passenger.name}
                            </p>
                            {ride.passenger.phone && (
                              <p className="text-[11px] text-stone-500 font-mono">
                                {ride.passenger.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="text-stone-400">—</span>
                        )}
                      </td>

                      {/* Driver */}
                      <td className="py-4 px-4 sm:px-5">
                        {ride.driver ? (
                          <div className="space-y-0.5">
                            <p className="font-medium text-stone-900 text-xs">
                              {ride.driver.name}
                            </p>
                            {ride.driver.phone && (
                              <p className="text-[11px] text-stone-500 font-mono">
                                {ride.driver.phone}
                              </p>
                            )}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium">
                            <Clock className="w-3 h-3" /> Awaiting driver
                          </span>
                        )}
                      </td>

                      {/* Route */}
                      <td className="py-4 px-4 sm:px-5 max-w-xs">
                        <div className="space-y-1.5">
                          <div className="flex items-start gap-1.5 text-xs text-stone-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                            <span className="truncate">{ride.pickup?.address || "Pickup"}</span>
                          </div>
                          <div className="flex items-start gap-1.5 text-xs text-stone-800">
                            <span className="w-2 h-2 rounded-full bg-rose-500 mt-1 shrink-0" />
                            <span className="truncate">{ride.destination?.address || "Destination"}</span>
                          </div>
                          <div className="text-[10px] text-stone-500 flex items-center gap-1.5 pt-0.5">
                            <span>{Number(ride.distanceKm || 0).toFixed(1)} km</span>
                            <span>·</span>
                            <span>~{ride.estimatedDurationMinutes || 0} mins</span>
                          </div>
                        </div>
                      </td>

                      {/* Fare */}
                      <td className="py-4 px-4 sm:px-5 text-right font-medium text-stone-900">
                        <span className="font-caslon text-base font-bold">
                          ₹{fareAmount}
                        </span>
                        <span className="block text-[10px] text-stone-400">
                          {ride.finalFare !== null ? "Final fare" : "Estimated"}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5 sm:px-6 text-center">
                        {getStatusBadge(ride.status)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. PAGINATION */}
        {!isLoading && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#EDEDE8] bg-[#FBFBFA] text-xs text-stone-600">
            <span>
              Showing {filteredRides.length} of {totalCount} rides
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 rounded-lg border border-[#EDEDE8] bg-white text-stone-700 disabled:opacity-40 cursor-pointer hover:bg-stone-50"
              >
                Previous
              </button>
              <span className="font-semibold text-stone-900">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 rounded-lg border border-[#EDEDE8] bg-white text-stone-700 disabled:opacity-40 cursor-pointer hover:bg-stone-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
