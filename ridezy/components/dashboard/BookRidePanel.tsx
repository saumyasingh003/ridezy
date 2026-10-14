"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  ArrowUpDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  LocateFixed,
  Navigation,
  Settings,
  Home,
  Briefcase,
  GraduationCap,
  Dumbbell,
  Coffee,
  MapPin,
  Plane,
  Train,
  ShoppingBag,
  BookOpen,
  HeartPulse,
  Building2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { type SavedPlaceItem } from "./data";
import { CURRENT_RIDE_HREF } from "./currentRide";
import type { Place } from "@/lib/rideApi";
import { getCurrentPosition, isInServiceArea, reverseGeocode, searchPlaces, SERVICE_AREA } from "@/lib/geocode";
import { API_BASE } from "@/lib/config";

function getPlaceIconComponent(place: SavedPlaceItem) {
  const norm = `${place.type || ""} ${place.label || ""}`.toLowerCase();
  if (norm.includes("home")) return Home;
  if (norm.includes("work") || norm.includes("office") || norm.includes("job")) return Briefcase;
  if (norm.includes("college") || norm.includes("school") || norm.includes("univ") || norm.includes("campus") || norm.includes("class"))
    return GraduationCap;
  if (norm.includes("gym") || norm.includes("fitness") || norm.includes("workout")) return Dumbbell;
  if (norm.includes("cafe") || norm.includes("coffee") || norm.includes("tea") || norm.includes("bakery")) return Coffee;
  if (norm.includes("hospital") || norm.includes("clinic") || norm.includes("health") || norm.includes("doctor")) return HeartPulse;
  if (norm.includes("airport") || norm.includes("flight")) return Plane;
  if (norm.includes("station") || norm.includes("metro") || norm.includes("train")) return Train;
  if (norm.includes("mall") || norm.includes("shop") || norm.includes("market") || norm.includes("store")) return ShoppingBag;
  if (norm.includes("library") || norm.includes("book")) return BookOpen;
  if (norm.includes("company") || norm.includes("building")) return Building2;
  return MapPin;
}

/**
 * Text input with address suggestions. Typing clears the chosen place (the
 * text no longer matches its coordinates); picking a suggestion sets it.
 */
function PlaceInput({
  label,
  placeholder,
  text,
  resolved,
  onTextChange,
  onSelect,
}: {
  label: string;
  placeholder: string;
  text: string;
  resolved: boolean;
  onTextChange: (value: string) => void;
  onSelect: (place: Place) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Place[]>([]);
  const typed = useRef(false);

  // Debounced search (Nominatim allows ~1 request/second).
  useEffect(() => {
    if (!typed.current || resolved || text.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    const timer = setTimeout(() => {
      searchPlaces(text, controller.signal)
        .then((rows) => setResults(rows))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, resolved]);

  const showList = open && !resolved && text.trim().length >= 3;

  return (
    <div className="relative">
      <label
        className="
          group
          relative
          flex
          items-center
          gap-3
          border
          border-transparent
          rounded-md
          bg-[#F4F4F4]
          px-3.5
          py-2.5
          transition-colors
          focus-within:border-[#111111]
          focus-within:bg-white
        "
      >
        <span className="relative z-10 flex h-3 w-3 shrink-0 items-center justify-center rounded-full bg-[#111111]">
          <span className="h-1 w-1 rounded-full bg-white" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#8A8A8A]">
            {label}
          </span>
          <input
            type="text"
            value={text}
            onChange={(e) => {
              typed.current = true;
              onTextChange(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            placeholder={placeholder}
            className="w-full truncate bg-transparent text-sm font-normal text-[#111111] placeholder:font-normal placeholder:text-[#A3A3A3] outline-none"
          />
        </span>
        {resolved && (
          <CheckCircle2 size={15} className="shrink-0 text-[#111111]" aria-label="Location confirmed" />
        )}
      </label>

      {showList && (
        <ul className="absolute left-0 right-0 top-full z-30 mt-1 max-h-64 overflow-y-auto rounded-md border border-[#E8E8E8] bg-white py-1 shadow-[0_12px_30px_-10px_rgba(0,0,0,0.25)]">
          {loading && (
            <li className="flex items-center gap-2 px-3.5 py-2.5 text-xs text-[#7A7A7A]">
              <Loader2 size={13} className="animate-spin" /> Searching…
            </li>
          )}
          {!loading && results.length === 0 && (
            <li className="px-3.5 py-2.5 text-xs text-[#7A7A7A]">No matching places in {SERVICE_AREA.name}. Try a nearby landmark.</li>
          )}
          {results.map((place) => (
            <li key={`${place.latitude},${place.longitude}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  typed.current = false;
                  onSelect(place);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-2.5 px-3.5 py-2.5 text-left text-sm text-[#111111] hover:bg-[#F4F4F4]"
              >
                <MapPin size={14} className="mt-0.5 shrink-0 text-[#7A7A7A]" />
                <span className="line-clamp-2">{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface BookRidePanelProps {
  pickup: string;
  destination: string;
  pickupResolved: boolean;
  destinationResolved: boolean;
  onPickupChange: (value: string) => void;
  onDestinationChange: (value: string) => void;
  onPickupSelect: (place: Place) => void;
  onDestinationSelect: (place: Place) => void;
  onSwap: () => void;
  hasActiveRide: boolean;
}

export default function BookRidePanel({
  pickup,
  destination,
  pickupResolved,
  destinationResolved,
  onPickupChange,
  onDestinationChange,
  onPickupSelect,
  onDestinationSelect,
  onSwap,
  hasActiveRide,
}: BookRidePanelProps) {
  const router = useRouter();
  const [places, setPlaces] = useState<SavedPlaceItem[]>([]);
  const [locating, setLocating] = useState(false);
  const [locationError, setLocationError] = useState("");

  const handleCurrentLocation = async () => {
    setLocating(true);
    setLocationError("");
    try {
      const { latitude, longitude } = await getCurrentPosition();
      if (!isInServiceArea(latitude, longitude)) {
        throw new Error(`You seem to be outside ${SERVICE_AREA.name}. Ridezy currently serves ${SERVICE_AREA.name} only.`);
      }
      const address = await reverseGeocode(latitude, longitude);
      onPickupSelect({ address, latitude, longitude });
    } catch (err) {
      setLocationError((err as Error).message);
    } finally {
      setLocating(false);
    }
  };

  const selectSavedPlace = (place: SavedPlaceItem) => {
    if (
      typeof place.latitude === "number" &&
      typeof place.longitude === "number" &&
      isInServiceArea(place.latitude, place.longitude)
    ) {
      onDestinationSelect({ address: place.address, latitude: place.latitude, longitude: place.longitude });
    } else {
      // No stored coordinates: put the text in and let the user pick a match.
      onDestinationChange(place.address);
    }
  };

  useEffect(() => {
    const isMockPlace = (p: any) => {
      const addr = (p.address || "").toLowerCase();
      const id = String(p.id || p._id || "");
      return (
        addr.includes("boring road") ||
        addr.includes("fraser road") ||
        addr.includes("amity university") ||
        addr.includes("kankarbagh") ||
        addr.includes("rajendra nagar") ||
        addr.includes("electronic city") ||
        (addr.includes("mg road") && addr.includes("bangalore")) ||
        id.startsWith("sp-")
      );
    };

    // 1. Initial instantaneous check from localStorage
    const loadStored = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("ridezySavedPlaces");
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed)) {
              const realPlaces = parsed.filter((p: any) => !isMockPlace(p));
              if (realPlaces.length > 0) {
                setPlaces(realPlaces);
                return true;
              } else {
                // Remove legacy fake mock items
                localStorage.removeItem("ridezySavedPlaces");
                setPlaces([]);
                return false;
              }
            }
          } catch { }
        }
      }
      setPlaces([]);
      return false;
    };

    const hasStored = loadStored();

    // 2. Fetch fresh saved places from backend API
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    if (token) {
      fetch(`${API_BASE}/passengers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => {
          if (res.status === 401) {
            if (typeof window !== "undefined") {
              localStorage.clear();
              window.location.href = "/";
            }
            return null;
          }
          return res.json();
        })
        .then((json) => {
          if (!json) return;
          if (
            json.success &&
            json.data?.savedPlaces &&
            Array.isArray(json.data.savedPlaces) &&
            json.data.savedPlaces.length > 0
          ) {
            const realPlaces = json.data.savedPlaces.filter((p: any) => !isMockPlace(p));
            setPlaces(realPlaces);
            if (typeof window !== "undefined") {
              if (realPlaces.length > 0) {
                localStorage.setItem("ridezySavedPlaces", JSON.stringify(realPlaces));
              } else {
                localStorage.removeItem("ridezySavedPlaces");
              }
            }
          } else {
            // No saved places -> show blank!
            setPlaces([]);
          }
        })
        .catch(() => {
          if (!hasStored) {
            setPlaces([]);
          }
        });
    } else if (!hasStored) {
      setPlaces([]);
    }

    // 3. Keep in sync when user updates saved places
    const handleStorage = () => {
      loadStored();
    };
    window.addEventListener("storage", handleStorage);
    window.addEventListener("ridezy_saved_places_updated", handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("ridezy_saved_places_updated", handleStorage);
    };
  }, []);

  return (
    <section
      aria-labelledby="book-title"
      className="order-1 flex flex-col border-b border-[#E8E8E8] bg-white px-5 py-6 lg:overflow-y-auto lg:border-b-0 lg:border-r"
    >
      {/* Header */}
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
        New trip
      </p>
      <h1
        id="book-title"
        className="mt-1.5 font-caslon text-3xl font-bold leading-none tracking-tight text-[#111111]"
      >
        Book a Ride
      </h1>
      <div className="mt-3 h-[3px] w-10 bg-[#111111]" />

      {/* Route inputs */}
      <div className="relative mt-6">
        {/* Connector */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-[19px] top-[30px] bottom-[30px] w-px bg-[#111111]/25"
        />

        <PlaceInput
          label="Pickup"
          placeholder="Pickup in Patna"
          text={pickup}
          resolved={pickupResolved}
          onTextChange={onPickupChange}
          onSelect={onPickupSelect}
        />

        <div className="relative h-2">
          <button
            type="button"
            onClick={onSwap}
            aria-label="Swap pickup and destination"
            className="
              absolute
              right-3
              top-1/2
              z-10
              flex
              h-8
              w-8
              -translate-y-1/2
              items-center
              justify-center
              rounded-md
              bg-[#111111]
              text-white
              shadow-[0_4px_12px_rgba(0,0,0,0.2)]
              transition-transform
              duration-300
              hover:rotate-180
            "
          >
            <ArrowUpDown size={14} strokeWidth={2.25} />
          </button>
        </div>

        <PlaceInput
          label="Destination"
          placeholder="Drop in Patna"
          text={destination}
          resolved={destinationResolved}
          onTextChange={onDestinationChange}
          onSelect={onDestinationSelect}
        />
      </div>

      {/* Current location */}
      <button
        type="button"
        onClick={handleCurrentLocation}
        disabled={locating}
        className="
          mt-3
          flex
          w-full
          items-center
          gap-2
          px-1
          py-1.5
          text-xs
          font-semibold
          text-[#111111]
          underline-offset-4
          hover:underline
          disabled:opacity-60
        "
      >
        {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
        {locating ? "Finding your location…" : "Use current location"}
      </button>
      {locationError && (
        <p role="alert" className="px-1 text-xs font-medium text-[#B3261E]">
          {locationError}
        </p>
      )}
      {/* Recent - only show when user actually has saved places */}
      {places.length > 0 && (
        <>
          <div className="mt-7 flex items-center gap-3">
            <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8A8A8A]">
              Recent
            </h2>
            <div className="h-px flex-1 bg-[#E8E8E8]" />
          </div>

          <ul className="mt-3 space-y-1">
            {places.map((place, idx) => {
              const Icon = getPlaceIconComponent(place);
              const selected = destination === place.address;
              const key = place.id || place._id || `${place.label}-${idx}`;
              return (
                <li key={key}>
                  <div
                    className={`
                      group
                      flex
                      w-full
                      items-center
                      gap-2
                      border-l-2
                      px-2.5
                      py-2
                      text-left
                      transition-colors
                      duration-200
                      ${selected
                        ? "border-[#111111] bg-[#F4F4F4]"
                        : "border-transparent hover:bg-[#F7F7F7]"
                      }
                    `}
                  >
                    <button
                      type="button"
                      onClick={() => selectSavedPlace(place)}
                      aria-pressed={selected}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left cursor-pointer"
                    >
                      <span
                        className={`
                          flex
                          h-9
                          w-9
                          shrink-0
                          items-center
                          justify-center
                          border
                          transition-colors
                          duration-200
                          ${selected
                            ? "border-[#111111] bg-[#111111] text-white"
                            : "border-[#E0E0E0] bg-white text-[#111111] group-hover:border-[#111111] group-hover:bg-[#111111] group-hover:text-white"
                          }
                        `}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-[#111111]">
                          {(place.label || "").replace(/^[\p{Extended_Pictographic}\s]+/u, "").trim() || place.label}
                        </span>
                        <span className="block truncate text-xs text-[#7A7A7A]">
                          {place.address}
                        </span>
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push("/dashboard/profile");
                      }}
                      title="Manage saved places in profile"
                      aria-label="Manage in Profile"
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[#7A7A7A] hover:bg-[#111111] hover:text-white transition-colors duration-200 cursor-pointer"
                    >
                      <ChevronRight size={15} strokeWidth={2.25} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {/* Current ride + Settings */}
      <div className="mt-auto space-y-2 pt-8">
        <button
          type="button"
          onClick={() => router.push(CURRENT_RIDE_HREF)}
          className="
            group
            flex
            w-full
            items-center
            gap-3
            rounded-md
            border
            border-[#111111]
            bg-white
            px-3.5
            py-3
            text-sm
            font-semibold
            text-[#111111]
            transition-colors
            duration-200
            hover:bg-[#F4F4F4]
          "
        >
          <Navigation
            size={17}
            className="transition-transform duration-300 group-hover:rotate-45"
          />
          Current Ride
          {hasActiveRide ? (
            <span className="relative ml-auto flex h-2 w-2" aria-label="Ride in progress">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#111111] opacity-40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#111111]" />
            </span>
          ) : (
            <span className="ml-auto" />
          )}
          <ChevronRight size={15} className="opacity-60" />
        </button>

        <button
          type="button"
          onClick={() => router.push("/dashboard/profile")}
          className="
            group
            flex
            w-full
            items-center
            gap-3
            rounded-md
            bg-[#111111]
            px-3.5
            py-3
            text-sm
            font-semibold
            text-white
            shadow-[0_6px_16px_-6px_rgba(0,0,0,0.45)]
            transition-colors
            duration-200
            hover:bg-black
          "
        >
          <Settings
            size={17}
            className="transition-transform duration-500 group-hover:rotate-90"
          />
          Settings
          <ChevronRight size={15} className="ml-auto opacity-60" />
        </button>
      </div>
    </section>
  );
}
