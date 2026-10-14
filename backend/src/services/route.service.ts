import { env } from "../config/env.js";
import { AppError } from "../utils/AppError.js";
import { haversineKm, type LatLng } from "../utils/geo.js";
import { logger } from "../utils/logger.js";

// The rest of the app only knows calculateRoute(). Which provider answers
// (OSRM today, something else tomorrow) is a config value, not a code change.

export type RouteSource = "OSRM" | "ESTIMATED";

export interface Route {
  distanceKm: number;
  durationMinutes: number;
  /** Encoded polyline for drawing the route on a map (Leaflet/MapLibre); null if unavailable. */
  geometry: string | null;
  source: RouteSource;
}

interface RouteProvider {
  route(from: LatLng, to: LatLng): Promise<Omit<Route, "source">>;
}

/** The provider answered, but there is no drivable route (e.g. across water). Not worth a fallback. */
class NoRouteError extends Error {}

/* ------------------------------- Providers --------------------------------- */

export const ROAD_FACTOR = 1.3; // roads are ~30% longer than a straight line in a city
export const FALLBACK_SPEED_KMH = 20; // conservative city average

/** Offline straight-line estimate. Deterministic: used in tests and as the fallback. */
const haversineProvider: RouteProvider = {
  async route(from, to) {
    const distanceKm = haversineKm(from, to) * ROAD_FACTOR;
    return { distanceKm, durationMinutes: (distanceKm / FALLBACK_SPEED_KMH) * 60, geometry: null };
  },
};

/** OSRM HTTP API: https://project-osrm.org/docs/v5.24.0/api/#route-service */
const osrmProvider: RouteProvider = {
  async route(from, to) {
    // OSRM takes "lng,lat;lng,lat" (x,y order, like GeoJSON).
    const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
    const url = `${env.routing.osrmBaseUrl}/route/v1/driving/${coords}?overview=simplified&geometries=polyline`;

    const res = await fetch(url, { signal: AbortSignal.timeout(env.routing.timeoutMs) });
    const body = (await res.json().catch(() => null)) as {
      code?: string;
      routes?: { distance: number; duration: number; geometry?: string }[];
    } | null;

    if (body?.code === "NoRoute") throw new NoRouteError();
    const best = body?.routes?.[0];
    if (!res.ok || body?.code !== "Ok" || !best) {
      throw new Error(`OSRM responded ${res.status} ${body?.code ?? ""}`.trim());
    }
    return { distanceKm: best.distance / 1000, durationMinutes: best.duration / 60, geometry: best.geometry ?? null };
  },
};

/* --------------------------------- Service --------------------------------- */

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Road distance and duration between two points. Never trusts client values.
 *
 * Failure handling:
 *  - provider down / slow / malformed → fall back to the straight-line estimate,
 *    flagged `source: "ESTIMATED"`, so booking keeps working during an outage
 *  - provider says "no route exists" → 422, a real answer, not an outage
 */
export async function calculateRoute(from: LatLng, to: LatLng): Promise<Route> {
  let raw: Omit<Route, "source">;
  let source: RouteSource = "OSRM";

  if (env.routing.provider === "haversine") {
    raw = await haversineProvider.route(from, to);
    source = "ESTIMATED";
  } else {
    try {
      raw = await osrmProvider.route(from, to);
    } catch (err) {
      if (err instanceof NoRouteError) {
        throw new AppError(422, "No drivable route between pickup and destination.");
      }
      logger.warn("Routing provider failed; using straight-line estimate", err instanceof Error ? err.message : err);
      raw = await haversineProvider.route(from, to);
      source = "ESTIMATED";
    }
  }

  return {
    distanceKm: round1(raw.distanceKm),
    durationMinutes: Math.max(1, Math.ceil(raw.durationMinutes)),
    geometry: raw.geometry,
    source,
  };
}
