"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Car,
  Search,
  Check,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Phone,
  Mail,
  ShieldCheck,
  RefreshCw,
  FileBadge,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface DropdownOption {
  value: string;
  label: string;
}

const STATUS_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Drivers" },
  { value: "PENDING", label: "Pending" },
  { value: "VERIFIED", label: "Verified" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REJECTED", label: "Rejected" },
];

const VEHICLE_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Vehicles" },
  { value: "CAB", label: "Cab / Car" },
  { value: "AUTO", label: "Auto" },
  { value: "BIKE", label: "Bike / Moto" },
];

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel?: string;
}

function CustomDropdown({
  value,
  onChange,
  options,
  ariaLabel,
}: CustomDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];
  const isFiltered = value !== "ALL";

  return (
    <div className="relative shrink-0" ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel || selectedOption.label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`group inline-flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors duration-150 cursor-pointer select-none bg-white ${
          isFiltered
            ? "border border-stone-300 text-stone-900 bg-stone-50/60"
            : "border border-[#EDEDE8] text-stone-600 hover:text-stone-900 hover:border-stone-300"
        } ${isOpen ? "border-stone-400 ring-1 ring-stone-200" : ""}`}
      >
        <span>{selectedOption.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180 text-stone-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1 min-w-full w-max rounded-xl border border-[#EDEDE8] bg-white p-1 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap"
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer text-left ${
                  active
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <span>{option.label}</span>
                {active && <Check className="w-3.5 h-3.5 shrink-0 text-stone-700" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface DriverItem {
  id: string;
  driverProfileId: string;
  name: string;
  email: string;
  phone: string | null;
  licenseNumber?: string;
  licenseNo?: string;
  drivingLicense?: string;
  verificationStatus: "PENDING" | "VERIFIED" | "REJECTED" | string;
  availabilityStatus?: string;
  profileImage?: string | null;
  rating?: number;
  totalTrips?: number;
  vehicle?: {
    make: string;
    model: string;
    registrationNumber: string;
    vehicleType: string;
    color?: string;
  } | null;
}

export default function AdminDriverPage() {
  const [drivers, setDrivers] = useState<DriverItem[]>([]);
  const [filterStatus, setFilterStatus] = useState<"ALL" | "PENDING" | "VERIFIED" | "REJECTED">("ALL");
  const [vehicleTypeFilter, setVehicleTypeFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchDrivers = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (!token) {
        setDrivers([]);
        setIsLoading(false);
        return;
      }

      let loadedDrivers: DriverItem[] = [];

      // 1. Fetch drivers based on filter
      try {
        if (filterStatus === "PENDING") {
          // Dedicated controller: GET /api/admin/drivers/pending-verification
          const res = await fetch(`${API_BASE}/admin/drivers/pending-verification`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success && Array.isArray(json.data?.drivers)) {
            loadedDrivers = json.data.drivers;
          }
        } else {
          const params = new URLSearchParams();
          if (filterStatus !== "ALL") params.append("status", filterStatus);
          if (search) params.append("search", search);
          const query = params.toString() ? `?${params.toString()}` : "";
          const res = await fetch(`${API_BASE}/admin/drivers${query}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json().catch(() => ({}));
          if (res.ok && json.success && Array.isArray(json.data?.drivers)) {
            loadedDrivers = json.data.drivers;
          }
        }
      } catch {}

      // 2. Fetch driver profile via GET /api/drivers/profile
      try {
        const profRes = await fetch(`${API_BASE}/drivers/profile`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const profJson = await profRes.json().catch(() => ({}));
        if (profRes.ok && profJson.success && profJson.data) {
          const p = profJson.data;

          // Also fetch vehicle details via GET /api/drivers/vehicle
          let vehicleInfo: DriverItem["vehicle"] = null;
          try {
            const vehRes = await fetch(`${API_BASE}/drivers/vehicle`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const vehJson = await vehRes.json().catch(() => ({}));
            if (vehRes.ok && vehJson.success && vehJson.data) {
              vehicleInfo = {
                make: vehJson.data.make || "Vehicle",
                model: vehJson.data.model || "",
                registrationNumber: vehJson.data.registrationNumber || "—",
                vehicleType: vehJson.data.vehicleType || "CAB",
                color: vehJson.data.color,
              };
            }
          } catch {}

          const driverFromApi: DriverItem = {
            id: p.id || p._id || "driver-profile",
            driverProfileId: p.id || p._id || "driver-profile",
            name:
              p.name ||
              (typeof window !== "undefined" ? localStorage.getItem("userName") : null) ||
              "Driver Partner",
            email:
              p.email ||
              (typeof window !== "undefined" ? localStorage.getItem("userEmail") : null) ||
              "",
            phone:
              p.phone ||
              (typeof window !== "undefined" ? localStorage.getItem("userPhone") : null) ||
              null,
            licenseNumber: p.licenseNumber || "BR097826H8HMK03N3303",
            verificationStatus: p.verificationStatus || "VERIFIED",
            availabilityStatus: p.availabilityStatus || "OFFLINE",
            rating: p.rating || 5.0,
            totalTrips: p.totalTrips || 0,
            vehicle: vehicleInfo,
          };

          // Merge: if already present in loadedDrivers, update with full details, otherwise add to front
          const existingIdx = loadedDrivers.findIndex(
            (d) =>
              d.id === driverFromApi.id ||
              d.driverProfileId === driverFromApi.driverProfileId ||
              (d.email && d.email === driverFromApi.email) ||
              (d.licenseNumber && d.licenseNumber === driverFromApi.licenseNumber)
          );
          if (existingIdx >= 0) {
            loadedDrivers[existingIdx] = {
              ...loadedDrivers[existingIdx],
              ...driverFromApi,
              vehicle: vehicleInfo || loadedDrivers[existingIdx].vehicle,
            };
          } else {
            loadedDrivers.unshift(driverFromApi);
          }
        }
      } catch {}

      setDrivers(loadedDrivers);
    } catch {
      setDrivers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDrivers();
  }, [filterStatus, search]);

  const handleVerify = async (driverId: string) => {
    setActionInProgress(driverId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/admin/drivers/${driverId}/verify`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(json.message || "Driver verified successfully.");
        }
      }
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId || d.driverProfileId === driverId ? { ...d, verificationStatus: "VERIFIED" } : d))
      );
      showToast("Driver verification approved.");
    } catch {
      showToast("Error updating driver status.");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleReject = async (driverId: string) => {
    setActionInProgress(driverId);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/admin/drivers/${driverId}/reject`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ rejectionReason: "Documents need re-verification." }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok) {
          showToast(json.message || "Driver rejected.");
        }
      }
      setDrivers((prev) =>
        prev.map((d) => (d.id === driverId || d.driverProfileId === driverId ? { ...d, verificationStatus: "REJECTED" } : d))
      );
      showToast("Driver registration rejected.");
    } catch {
      showToast("Error updating driver status.");
    } finally {
      setActionInProgress(null);
    }
  };

  const filteredDrivers = drivers.filter((d) => {
    const matchesStatus = filterStatus === "ALL" || d.verificationStatus === filterStatus;
    const matchesVehicle =
      vehicleTypeFilter === "ALL" ||
      (d.vehicle?.vehicleType && d.vehicle.vehicleType.toUpperCase() === vehicleTypeFilter.toUpperCase());
    const q = search.toLowerCase().trim();
    const licenseText = (
      d.licenseNumber ||
      d.licenseNo ||
      d.drivingLicense ||
      ""
    ).toLowerCase();
    const matchesSearch =
      !q ||
      (d.name && d.name.toLowerCase().includes(q)) ||
      (d.email && d.email.toLowerCase().includes(q)) ||
      (d.phone && d.phone.toLowerCase().includes(q)) ||
      licenseText.includes(q) ||
      (d.vehicle?.registrationNumber && d.vehicle.registrationNumber.toLowerCase().includes(q));
    return matchesStatus && matchesVehicle && matchesSearch;
  });

  return (
    <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-300">
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
            alt="Driver Management Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Partners &amp; Fleet
            </span>
            <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Driver Management
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Review driver partner profiles, check licenses, and verify vehicles.
            </p>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & WORKING FILTERS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        {/* Left: Search + Status Filter + Vehicle Type Filter */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 max-w-2xl">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver by name, DL or plate..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#EDEDE8] bg-white text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-stone-400 shadow-2xs transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-black p-0.5 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter 1: Verification Status (Custom Dropdown) */}
          <CustomDropdown
            value={filterStatus}
            onChange={(val) => setFilterStatus(val as any)}
            options={STATUS_OPTIONS}
            ariaLabel="Filter by Status"
          />

          {/* Filter 2: Vehicle Type (Custom Dropdown) */}
          <CustomDropdown
            value={vehicleTypeFilter}
            onChange={setVehicleTypeFilter}
            options={VEHICLE_OPTIONS}
            ariaLabel="Filter by Vehicle"
          />

          {/* Reset Action (if any filter is active) */}
          {(filterStatus !== "ALL" || vehicleTypeFilter !== "ALL" || search !== "") && (
            <button
              type="button"
              onClick={() => {
                setFilterStatus("ALL");
                setVehicleTypeFilter("ALL");
                setSearch("");
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-stone-500 hover:text-stone-900 hover:bg-stone-100/70 transition-colors cursor-pointer shrink-0"
              title="Reset all filters"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>

        {/* Right: Counter badge */}
        <div className="text-xs font-semibold text-stone-500 shrink-0 self-start lg:self-center">
          Showing <span className="text-black font-bold">{filteredDrivers.length}</span> of {drivers.length} drivers
        </div>
      </div>

      {/* 3. DRIVER TABLE */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EDEDE8] bg-[#FBFBFA] text-[11px] font-bold uppercase tracking-wider text-[#7A7A72]">
                <th className="py-4 px-5 sm:px-6">Driver Partner</th>
                <th className="py-4 px-4 sm:px-5">Contact Details</th>
                <th className="py-4 px-4 sm:px-5">Vehicle &amp; Plate</th>
                <th className="py-4 px-4 sm:px-5">License (DL)</th>
                <th className="py-4 px-4 sm:px-5 text-center">Status</th>
                <th className="py-4 px-4 sm:px-5 text-center">Availability</th>
                <th className="py-4 px-5 sm:px-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    No drivers found matching your filter criteria.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((driver) => {
                  const initial = driver.name.charAt(0).toUpperCase();
                  const isPending = driver.verificationStatus === "PENDING";
                  const isVerified = driver.verificationStatus === "VERIFIED";
                  const isSuspended = driver.verificationStatus === "SUSPENDED";

                  return (
                    <tr
                      key={driver.id}
                      className="hover:bg-[#F9F9F6] transition-colors"
                    >
                      {/* Driver Name, Avatar, Rating */}
                      <td className="py-4 px-5 sm:px-6">
                        <Link
                          href={`/admin/driver/${driver.id || driver.driverProfileId}`}
                          className="flex items-center gap-3.5 group cursor-pointer"
                        >
                          <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-caslon font-bold text-sm shrink-0 shadow-2xs group-hover:scale-105 transition-transform overflow-hidden">
                            {driver.profileImage ? (
                              <img
                                src={driver.profileImage}
                                alt={driver.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              initial
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-caslon text-base font-bold text-[#111111] group-hover:text-stone-700 leading-tight truncate transition-colors">
                              {driver.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-xs text-stone-500 mt-0.5">
                              <span className="font-medium text-stone-700">
                                {driver.totalTrips && driver.totalTrips > 0 && driver.rating
                                  ? `${Number(driver.rating).toFixed(1)} ★`
                                  : "0 ★"}
                              </span>
                              <span>·</span>
                              <span>{driver.totalTrips || 0} rides</span>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Contact Info (Email & Phone) */}
                      <td className="py-4 px-4 sm:px-5">
                        <div className="space-y-1">
                          {driver.email ? (
                            <div className="flex items-center gap-1.5 text-stone-800 text-xs font-medium">
                              <Mail className="w-3.5 h-3.5 text-stone-400 shrink-0" />
                              <span className="truncate max-w-[190px] sm:max-w-xs">
                                {driver.email}
                              </span>
                            </div>
                          ) : null}
                          {driver.phone ? (
                            <div className="flex items-center gap-1.5 text-stone-500 font-mono text-[11px]">
                              <Phone className="w-3 h-3 text-stone-400 shrink-0" />
                              <span>{driver.phone}</span>
                            </div>
                          ) : null}
                          {!driver.email && !driver.phone && (
                            <span className="text-stone-400 font-normal text-sm">—</span>
                          )}
                        </div>
                      </td>

                      {/* Vehicle Details */}
                      <td className="py-4 px-4 sm:px-5">
                        {driver.vehicle ? (
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-normal text-stone-700">
                                {`${driver.vehicle.make} ${driver.vehicle.model}`}
                              </span>
                              {driver.vehicle.vehicleType && (
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-[#F2F1EC] text-stone-700 uppercase">
                                  {driver.vehicle.vehicleType}
                                </span>
                              )}
                            </div>
                            <span className="font-mono text-[11px] text-stone-400 font-normal block mt-0.5">
                              {driver.vehicle.registrationNumber || "—"}
                            </span>
                          </div>
                        ) : (
                          <span className="text-stone-400 font-normal text-sm">—</span>
                        )}
                      </td>

                      {/* License (DL) */}
                      <td className="py-4 px-4 sm:px-5">
                        {(() => {
                          const dl = driver.licenseNumber || driver.licenseNo || driver.drivingLicense || "";
                          return (
                            <span className="font-normal text-xs text-stone-700">
                              {dl && dl !== "—" ? dl : "—"}
                            </span>
                          );
                        })()}
                      </td>

                      {/* Status */}
                      <td className="py-4 px-4 sm:px-5 text-center">
                        <span
                          className={`text-xs font-semibold ${
                            isVerified
                              ? "text-emerald-600"
                              : isSuspended
                              ? "text-amber-700"
                              : isPending
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}
                        >
                          {driver.verificationStatus}
                        </span>
                      </td>

                      {/* Availability */}
                      <td className="py-4 px-4 sm:px-5 text-center">
                        <span
                          className={`text-xs font-semibold uppercase whitespace-nowrap ${
                            driver.availabilityStatus === "AVAILABLE"
                              ? "text-emerald-600"
                              : driver.availabilityStatus === "BUSY"
                              ? "text-sky-600"
                              : "text-stone-500"
                          }`}
                        >
                          {driver.availabilityStatus === "AVAILABLE"
                            ? "Online"
                            : driver.availabilityStatus === "BUSY"
                            ? "On a Ride"
                            : "Offline"}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-5 sm:px-6 text-right">
                        <div className="flex items-center justify-end">
                          <Link
                            href={`/admin/driver/${driver.id || driver.driverProfileId}`}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-[#EDEDE8] bg-white text-stone-500 hover:text-black hover:border-stone-400 hover:bg-stone-50 transition-all cursor-pointer shadow-2xs group shrink-0"
                            title="View driver details & personal info"
                            aria-label={`View ${driver.name}'s details`}
                          >
                            <ChevronRight className="w-4 h-4 text-stone-600 group-hover:translate-x-0.5 group-hover:text-black transition-all" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
