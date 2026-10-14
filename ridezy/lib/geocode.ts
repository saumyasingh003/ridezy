// Address search for the booking form. The backend needs coordinates for
// pickup/destination, so typed text is turned into a Place here.
//
// Uses OpenStreetMap Nominatim (free, no key). Its usage policy allows at most
// ~1 request/second, so callers must debounce. Swap this file for Google
// Places / Mapbox later without touching the components.

import type { Place } from "./rideApi";

const NOMINATIM = "https://nominatim.openstreetmap.org";

/**
 * Service area: Patna (Danapur in the west to Patna City / Fatuha road in the
 * east, Ganga in the north to Phulwari Sharif in the south). Searches are
 * bounded to this box, so only Patna addresses are suggested.
 */
export const SERVICE_AREA = {
  name: "Patna",
  west: 84.95,
  east: 85.35,
  north: 25.7,
  south: 25.48,
};

export function isInServiceArea(latitude: number, longitude: number): boolean {
  return (
    latitude >= SERVICE_AREA.south &&
    latitude <= SERVICE_AREA.north &&
    longitude >= SERVICE_AREA.west &&
    longitude <= SERVICE_AREA.east
  );
}

interface NominatimResult {
  display_name: string;
  lat: string;
  lon: string;
}

/** Shortens "A, B, C, District, State, PIN, India" to the first few parts. */
function shortAddress(displayName: string): string {
  return displayName.split(",").slice(0, 4).join(",").trim();
}

export async function searchPlaces(query: string, signal?: AbortSignal): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  // viewbox = left,top,right,bottom; bounded=1 → results only inside the box.
  const { west, north, east, south } = SERVICE_AREA;
  const url =
    `${NOMINATIM}/search?format=jsonv2&limit=6&countrycodes=in&bounded=1` +
    `&viewbox=${west},${north},${east},${south}&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal, headers: { "Accept-Language": "en" } });
  if (!res.ok) return [];
  const rows = (await res.json()) as NominatimResult[];
  return rows
    .map((r) => ({
      address: shortAddress(r.display_name),
      latitude: Number(r.lat),
      longitude: Number(r.lon),
    }))
    .filter((p) => isInServiceArea(p.latitude, p.longitude)); // belt and braces
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string> {
  try {
    const res = await fetch(`${NOMINATIM}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, {
      headers: { "Accept-Language": "en" },
    });
    const json = (await res.json()) as Partial<NominatimResult>;
    if (json.display_name) return shortAddress(json.display_name);
  } catch {}
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export function getCurrentPosition(): Promise<{ latitude: number; longitude: number }> {
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
              ? "Allow location access in your browser to use your current location."
              : "Could not get your current location. Try again."
          )
        ),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  });
}
