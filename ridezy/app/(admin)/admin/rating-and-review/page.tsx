"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  Star,
  Search,
  MessageSquare,
  ThumbsUp,
  MapPin,
  Calendar,
  CheckCircle2,
  RefreshCw,
  Car,
  X,
  User,
  ShieldCheck,
  ChevronDown,
  Check,
} from "lucide-react";
import { API_BASE } from "@/lib/config";


interface ReviewItem {
  id: string;
  customerName: string;
  driverName: string;
  rating: number;
  vehicleType: string;
  route: string;
  date: string;
  comment: string;
  status: string;
}

const DEFAULT_REVIEWS: ReviewItem[] = [];

interface DropdownOption {
  value: string;
  label: string;
}

const RATING_OPTIONS: DropdownOption[] = [
  { value: "ALL", label: "All Ratings" },
  { value: "5", label: "5 Stars" },
  { value: "4", label: "4 Stars" },
  { value: "3", label: "3 Stars" },
  { value: "2", label: "2 Stars" },
  { value: "1", label: "1 Star" },
];

interface CustomDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  ariaLabel?: string;
  className?: string;
}

function CustomDropdown({
  value,
  onChange,
  options,
  ariaLabel,
  className = "",
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
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        aria-label={ariaLabel || selectedOption.label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`w-full group inline-flex items-center justify-between gap-2.5 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-normal transition-colors duration-150 cursor-pointer select-none bg-white ${
          isFiltered
            ? "border border-stone-300 text-stone-900 bg-stone-50/60 font-medium"
            : "border border-[#EDEDE8] text-stone-600 hover:text-stone-900 hover:border-stone-300"
        } ${isOpen ? "border-stone-400 ring-1 ring-stone-200" : ""}`}
      >
        <span className="flex items-center gap-1.5">
          {selectedOption.value !== "ALL" && (
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
          )}
          <span>{selectedOption.label}</span>
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-stone-400 group-hover:text-stone-600 transition-transform duration-150 shrink-0 ${
            isOpen ? "rotate-180 text-stone-600" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div
          role="listbox"
          className="absolute left-0 mt-1 min-w-full w-max max-w-[calc(100vw-2rem)] rounded-xl border border-[#EDEDE8] bg-white p-1 shadow-md z-50 animate-in fade-in zoom-in-95 duration-100 whitespace-nowrap"
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
                className={`w-full flex items-center justify-between gap-3 px-2.5 py-1.5 rounded-lg text-xs font-normal transition-colors cursor-pointer text-left ${
                  active
                    ? "bg-stone-100 text-stone-900 font-medium"
                    : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                }`}
              >
                <span className="flex items-center gap-1.5">
                  {option.value !== "ALL" && (
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  )}
                  <span>{option.label}</span>
                </span>
                {active && <Check className="w-3.5 h-3.5 shrink-0 text-stone-700" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function AdminRatingReviewPage() {
  const [reviews, setReviews] = useState<ReviewItem[]>(DEFAULT_REVIEWS);
  const [selectedRating, setSelectedRating] = useState<string>("ALL");
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const fetchReviews = async () => {
    setIsLoading(true);
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
      if (token) {
        const res = await fetch(`${API_BASE}/admin/reviews`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success && Array.isArray(json.data)) {
          setReviews(json.data);
        } else {
          setReviews([]);
        }
      } else {
        setReviews([]);
      }
    } catch {
      setReviews([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const totalCount = reviews.length;
  const avgScore =
    totalCount > 0
      ? (reviews.reduce((acc, r) => acc + r.rating, 0) / totalCount).toFixed(2)
      : "0.0";
  const numScore = parseFloat(avgScore);

  const starBreakdown = [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    const percentage = totalCount > 0 ? Math.round((count / totalCount) * 100) : 0;
    return {
      stars,
      label: `${stars} Star${stars > 1 ? "s" : ""}`,
      percentage,
      count,
    };
  });

  const filteredReviews = reviews.filter((r) => {
    const matchesRating = selectedRating === "ALL" || r.rating.toString() === selectedRating;
    const matchesSearch =
      r.customerName.toLowerCase().includes(search.toLowerCase()) ||
      r.driverName.toLowerCase().includes(search.toLowerCase()) ||
      r.comment.toLowerCase().includes(search.toLowerCase()) ||
      r.route.toLowerCase().includes(search.toLowerCase());
    return matchesRating && matchesSearch;
  });

  return (
    <div className="w-full space-y-4 sm:space-y-5 animate-in fade-in duration-300">
      {/* 1. TOP HERO BANNER */}
      <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-white via-[#FCFBF7] to-[#F5F3EB] border border-[#EDEDE8] shadow-xs min-h-[175px] sm:min-h-[195px] lg:h-[220px] py-4 sm:py-5 flex items-center w-full shrink-0">
        {/* Background photo - visible only on wide screens (xl+) strictly confined to the right half to prevent text collision */}
        <div className="hidden xl:block absolute right-0 top-0 bottom-0 w-1/2 pointer-events-none select-none overflow-hidden">
          <Image
            src="/admin-banner.jpg"
            alt="Rating and Review Management Banner"
            fill
            priority
            className="object-cover object-right"
          />
          {/* Smooth gradient mask blending image into background card */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#FCFBF7] via-[#FCFBF7]/50 to-transparent" />
        </div>

        {/* Ambient glow accents on smaller screens */}
        <div className="xl:hidden pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-[#E5E9CA]/40 blur-2xl" />
        <div className="xl:hidden pointer-events-none absolute -left-12 -bottom-12 h-36 w-36 rounded-full bg-[#E5E9CA]/25 blur-2xl" />

        <div className="relative z-10 w-full px-4 sm:px-8 lg:px-12 py-2 sm:py-4 flex flex-col justify-center">
          <div className="max-w-2xl">
            <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.2em] text-[#555550]">
              Quality &amp; Feedback
            </span>
            <h1 className="font-caslon text-xl sm:text-3xl lg:text-4xl font-bold text-[#111111] tracking-tight leading-tight mt-1 break-words">
              Rating and Review Management
            </h1>
            <p className="text-xs sm:text-sm text-zinc-700 mt-1 sm:mt-1.5 font-medium leading-relaxed">
              Analyze rider trip ratings, customer feedback, and overall driver service satisfaction.
            </p>
          </div>
        </div>
      </div>

      {/* Ratings Overview Card */}
      <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-4 sm:p-6 lg:p-7 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-8 items-center">
        {/* Score Column */}
        <div className="lg:col-span-4 text-center lg:text-left pb-5 lg:pb-0 border-b lg:border-b-0 lg:border-r border-[#EDEDE8] lg:pr-6">
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#7A7A74]">
            Overall Platform Score
          </span>
          <div className="flex items-baseline justify-center lg:justify-start gap-2.5 mt-2">
            <span className="font-caslon text-5xl sm:text-6xl font-bold text-[#111111] tracking-tight">
              {avgScore}
            </span>
            <span className="text-sm font-semibold text-stone-400">/ 5.0</span>
          </div>
          <div className="flex items-center justify-center lg:justify-start gap-1.5 mt-2.5 text-amber-400">
            {[1, 2, 3, 4, 5].map((i) => (
              <Star
                key={i}
                className={`w-4 h-4 ${
                  i <= Math.round(numScore) && numScore > 0
                    ? "fill-amber-400 text-amber-400"
                    : "fill-stone-200 text-stone-200"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-stone-500 mt-2.5 text-center lg:text-left">
            {totalCount > 0
              ? `Based on ${totalCount} completed trip ${totalCount === 1 ? "review" : "reviews"}`
              : "No reviews yet · Based on 0 completed trips"}
          </p>
        </div>

        {/* Breakdown Bars: All 1, 2, 3, 4, 5 Stars */}
        <div className="lg:col-span-8 space-y-2">
          <div className="flex items-center justify-between pb-1 text-xs text-stone-400 font-medium">
            <span>Rating Breakdown</span>
            <span>Click to filter reviews</span>
          </div>

          {starBreakdown.map((item) => {
            const isSelected = selectedRating === item.stars.toString();
            return (
              <button
                key={item.stars}
                type="button"
                onClick={() =>
                  setSelectedRating(isSelected ? "ALL" : item.stars.toString())
                }
                className={`w-full flex items-center gap-2.5 sm:gap-3 py-1.5 px-2 sm:px-2.5 rounded-xl text-xs transition-colors cursor-pointer group text-left ${
                  isSelected
                    ? "bg-stone-100 ring-1 ring-stone-300"
                    : "hover:bg-stone-50"
                }`}
                title={`Filter by ${item.label}`}
              >
                <div className="w-12 sm:w-16 flex items-center gap-1 shrink-0">
                  <span className="font-semibold text-stone-800">
                    {item.stars}
                  </span>
                  <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                  <span className="text-stone-400 text-[11px] hidden sm:inline">
                    Star{item.stars > 1 ? "s" : ""}
                  </span>
                </div>

                <div className="flex-1 h-2.5 rounded-full bg-stone-100 overflow-hidden relative">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-300"
                    style={{
                      width: `${item.percentage}%`,
                    }}
                  />
                </div>

                <div className="w-16 sm:w-20 text-right flex items-center justify-end gap-1.5 shrink-0">
                  <span className="text-[11px] text-stone-400 font-mono hidden sm:inline">
                    ({item.count})
                  </span>
                  <span className="w-8 sm:w-9 text-right text-stone-600 font-mono font-medium">
                    {item.percentage}%
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. SEARCH & WORKING FILTERS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
        {/* Left: Search Bar */}
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reviews by comment, rider, or driver..."
            className="w-full pl-10 pr-9 py-2.5 rounded-xl border border-[#EDEDE8] bg-white text-xs sm:text-sm text-stone-900 placeholder:text-stone-400 shadow-2xs focus:outline-hidden focus:border-stone-400 transition-colors"
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

        {/* Right: Simple Rating Dropdown + Reset */}
        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          <CustomDropdown
            value={selectedRating}
            onChange={(val) => setSelectedRating(val)}
            options={RATING_OPTIONS}
            ariaLabel="Filter by Rating"
            className="flex-1 sm:flex-none"
          />

          {(selectedRating !== "ALL" || search !== "") && (
            <button
              type="button"
              onClick={() => {
                setSelectedRating("ALL");
                setSearch("");
              }}
              className="text-xs text-stone-500 hover:text-black font-normal transition-colors cursor-pointer py-2 px-3 rounded-xl hover:bg-stone-100 border border-[#EDEDE8] sm:border-0"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Reviews Section Header & Counter */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
            Verified Passenger Feedback
          </h2>
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 font-mono font-medium">
            {filteredReviews.length} {filteredReviews.length === 1 ? "Review" : "Reviews"}
          </span>
        </div>
      </div>

      {/* Reviews List: 1 data per row with reduced height */}
      <div className="space-y-2.5">
        {filteredReviews.length === 0 ? (
          <div className="rounded-2xl sm:rounded-3xl bg-white border border-[#EDEDE8] p-12 text-center text-stone-400 text-xs">
            No reviews found matching your search or rating criteria.
          </div>
        ) : (
          filteredReviews.map((rev) => (
            <div
              key={rev.id}
              className="rounded-xl sm:rounded-2xl bg-white border border-[#EDEDE8] px-4 py-3 sm:px-5 sm:py-3.5 shadow-2xs hover:border-stone-300 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              {/* Left: Customer -> Driver, Vehicle, Route & Feedback */}
              <div className="flex items-start md:items-center gap-3.5 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center font-caslon font-bold text-xs shrink-0 mt-0.5 md:mt-0">
                  {rev.customerName.charAt(0)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="font-bold text-stone-900">{rev.customerName}</span>
                    <span className="text-stone-300">→</span>
                    <span className="text-stone-600 font-medium">{rev.driverName}</span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-stone-100 text-stone-700">
                      {rev.vehicleType}
                    </span>
                    <span className="text-stone-300 hidden sm:inline">•</span>
                    <span className="text-stone-400 text-[11px] truncate hidden sm:inline">
                      {rev.route}
                    </span>
                  </div>

                  <p className="text-xs sm:text-[13px] text-stone-700 font-normal leading-snug mt-1 line-clamp-1 sm:line-clamp-2">
                    &ldquo;{rev.comment}&rdquo;
                  </p>
                </div>
              </div>

              {/* Right: Stars Rating + Date */}
              <div className="flex items-center justify-between md:justify-end gap-3.5 shrink-0 w-full md:w-auto pt-2.5 md:pt-0 border-t border-stone-100 md:border-0 pl-11 md:pl-0">
                {/* Rating Badge */}
                <div className="flex items-center gap-1.5 bg-amber-50/80 px-2.5 py-1 rounded-lg border border-amber-200/50">
                  <span className="font-mono font-bold text-xs text-amber-900">
                    {rev.rating}.0
                  </span>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={s}
                        className={`w-3 h-3 ${
                          s <= rev.rating
                            ? "fill-amber-400 text-amber-400"
                            : "fill-stone-200 text-stone-200"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Date */}
                <span className="text-[11px] text-stone-400 font-mono whitespace-nowrap">
                  {Number.isNaN(Date.parse(rev.date))
                    ? rev.date
                    : new Date(rev.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
