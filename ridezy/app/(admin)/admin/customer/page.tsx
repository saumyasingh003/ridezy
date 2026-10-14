"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Users,
  Search,
  ChevronDown,
  RotateCcw,
  X,
  Filter,
  Check,
} from "lucide-react";

const API_BASE = "http://localhost:5000/api";

interface DropdownOption {
  value: string;
  label: string;
}

const GENDER_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Genders" },
  { value: "FEMALE", label: "Female" },
  { value: "MALE", label: "Male" },
  { value: "OTHER", label: "Other" },
];

const PLACES_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Places" },
  { value: "WITH_PLACES", label: "Has Saved Places (1+)" },
  { value: "NO_PLACES", label: "No Saved Places (0)" },
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

interface CustomerItem {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth?: string | null;
  createdAt?: string;
  gender?: string | null;
  savedPlacesCount?: number;
  ridesCount?: number;
  completedRidesCount?: number;
}

export default function AdminCustomerPage() {
  const [customers, setCustomers] = useState<CustomerItem[]>([]);
  const [search, setSearch] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("ALL");
  const [placesFilter, setPlacesFilter] = useState<string>("ALL");
  const [isLoading, setIsLoading] = useState(false);

  const fetchCustomers = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const query = search ? `?search=${encodeURIComponent(search)}` : "";
        const res = await fetch(`${API_BASE}/admin/customers${query}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success && Array.isArray(json.data?.customers)) {
          setCustomers(json.data.customers);
        } else {
          setCustomers([]);
        }
      } else {
        setCustomers([]);
      }
    } catch {
      setCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const filteredCustomers = customers.filter((c) => {
    const q = search.toLowerCase().trim();
    const matchesSearch =
      !q ||
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.phone && c.phone.includes(q));

    const matchesGender =
      genderFilter === "ALL" ||
      (c.gender && c.gender.toUpperCase() === genderFilter.toUpperCase());

    const count = c.savedPlacesCount || 0;
    const matchesPlaces =
      placesFilter === "ALL" ||
      (placesFilter === "WITH_PLACES" && count > 0) ||
      (placesFilter === "NO_PLACES" && count === 0);

    return matchesSearch && matchesGender && matchesPlaces;
  });

  return (
    <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. TOP HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] shadow-xs h-[190px] sm:h-[210px] lg:h-[225px] flex items-center w-full shrink-0">
        <div className="absolute inset-0 w-full h-full pointer-events-none select-none">
          <Image
            src="/admin-banner.jpg"
            alt="Customer Management Banner"
            fill
            priority
            className="object-cover"
            style={{ objectPosition: "right 19%" }}
          />
        </div>

        <div className="relative z-10 w-full px-6 py-4 sm:px-8 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="max-w-xl">
            <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
              Account &amp; Security
            </span>
            <h1 className="font-caslon text-3xl sm:text-4xl lg:text-[40px] font-bold text-[#111111] tracking-tight leading-tight mt-1">
              Customer Management
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1 font-normal leading-relaxed">
              Manage registered customer profiles, contact info and ride preferences.
            </p>
          </div>
        </div>
      </div>

      {/* 2. SEARCH & 2 WORKING FILTERS BAR */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-1">
        {/* Left: Search + Filter 1 (Gender) + Filter 2 (Places) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 max-w-2xl">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer by name, email or phone..."
              className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#EDEDE8] bg-white text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 focus:outline-hidden focus:border-black shadow-2xs transition-colors"
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

          {/* Filter 1: Gender (Custom Dropdown) */}
          <CustomDropdown
            value={genderFilter}
            onChange={setGenderFilter}
            options={GENDER_OPTIONS}
            ariaLabel="Filter by Gender"
          />

          {/* Filter 2: Saved Places (Custom Dropdown) */}
          <CustomDropdown
            value={placesFilter}
            onChange={setPlacesFilter}
            options={PLACES_OPTIONS}
            ariaLabel="Filter by Saved Places"
          />

          {/* Reset Action (if any filter is active) */}
          {(genderFilter !== "ALL" || placesFilter !== "ALL" || search !== "") && (
            <button
              type="button"
              onClick={() => {
                setGenderFilter("ALL");
                setPlacesFilter("ALL");
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
          Showing <span className="text-black font-bold">{filteredCustomers.length}</span> of {customers.length} passengers
        </div>
      </div>

      {/* 3. REDESIGNED CUSTOMER TABLE (Showing DOB & No Status) */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          {/* Fixed widths: Contact gets the most room so emails fit */}
          <table className="w-full min-w-[1080px] table-fixed text-left border-collapse">
            <colgroup>
              <col className="w-[18%]" />
              <col className="w-[9%]" />
              <col className="w-[25%]" />
              <col className="w-[12%]" />
              <col className="w-[12%]" />
              <col className="w-[11%]" />
              <col className="w-[13%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-[#EDEDE8] bg-[#FBFBFA] text-[11px] font-bold uppercase tracking-wider text-[#7A7A72]">
                <th className="py-4 px-5 sm:px-6">Customer</th>
                <th className="py-4 px-4 sm:px-5">Gender</th>
                <th className="py-4 px-4 sm:px-5">Contact</th>
                <th className="py-4 px-4 sm:px-5">Date of Birth</th>
                <th className="py-4 px-4 sm:px-5">Joined Date</th>
                <th className="py-4 px-4 sm:px-5">Rides Taken</th>
                <th className="py-4 px-5 sm:px-6 text-right">Saved Places</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EFEA] text-xs sm:text-sm">
              {filteredCustomers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-stone-400 text-xs">
                    No customers found matching your search.
                  </td>
                </tr>
              ) : (
                filteredCustomers.map((customer) => {
                  const initial = customer.name.charAt(0).toUpperCase();

                  return (
                    <tr
                      key={customer.id}
                      className="hover:bg-[#F9F9F6] transition-colors"
                    >
                      {/* Customer Name, Avatar, Gender */}
                      <td className="py-4 px-5 sm:px-6">
                        <div className="flex items-center gap-3.5">
                          <div className="w-10 h-10 rounded-full bg-[#111111] text-white flex items-center justify-center font-caslon font-bold text-sm shrink-0 shadow-2xs">
                            {initial}
                          </div>
                          <div className="min-w-0">
                            <p className="font-caslon text-base font-bold text-[#111111] leading-tight truncate">
                              {customer.name}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Gender */}
                      <td className="py-4 px-4 sm:px-5 text-xs text-stone-500 capitalize">
                        {customer.gender ? customer.gender.toLowerCase().replace(/_/g, " ") : "—"}
                      </td>

                      {/* Contact (email & phone) */}
                      <td className="py-4 px-4 sm:px-5 text-xs text-stone-500">
                        <p className="truncate" title={customer.email}>
                          {customer.email}
                        </p>
                        {customer.phone && <p className="mt-0.5">{customer.phone}</p>}
                      </td>

                      {/* Date of Birth */}
                      <td className="py-4 px-4 sm:px-5 text-xs text-stone-500">{formatDate(customer.dateOfBirth)}</td>

                      {/* Joined Date */}
                      <td className="py-4 px-4 sm:px-5 text-xs text-stone-500">{formatDate(customer.createdAt)}</td>

                      {/* Rides Taken (completed rides) */}
                      <td className="py-4 px-4 sm:px-5 text-xs text-stone-500">
                        {customer.completedRidesCount ?? 0}{" "}
                        {(customer.completedRidesCount ?? 0) === 1 ? "ride" : "rides"}
                      </td>

                      {/* Saved Places */}
                      <td className="py-4 px-5 sm:px-6 text-right text-xs text-stone-500">
                        {customer.savedPlacesCount || 0} {(customer.savedPlacesCount || 0) === 1 ? "place" : "places"}
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
