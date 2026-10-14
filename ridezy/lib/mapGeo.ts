// Small geo helpers for the maps (MapLibre + OpenFreeMap tiles) and the drive
// simulator. Coordinates are { latitude, longitude } like the backend's.

export interface LatLng {
  latitude: number;
  longitude: number;
}

/** OpenFreeMap vector style ("liberty", recoloured by MAP_COLOURS). Free, no API key; attribution is shown by the map. */
export const MAP_STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

/**
 * Google-Maps-like palette applied on top of the OpenFreeMap style: light grey
 * land, white streets, yellow highways, green parks, blue water. Each rule is
 * [layer id pattern, paint property, colour].
 */
export const MAP_COLOURS: [RegExp, string, string][] = [
  [/^background$/, "background-color", "#f1f1ef"],
  [/^landuse_residential$/, "fill-color", "#ebebe9"],
  [/^park$/, "fill-color", "#c4e7c0"],
  [/^park_outline$/, "line-color", "#b3dcae"],
  [/^landcover_(wood|grass)$/, "fill-color", "#cde8c5"],
  [/^water$/, "fill-color", "#a8d4f7"],
  [/^waterway_/, "line-color", "#a8d4f7"],
  [/^building$/, "fill-color", "#e1e1df"],
  // Highways: yellow with an orange edge.
  [/^(tunnel|road|bridge)_motorway(_link)?$/, "line-color", "#ffe28a"],
  [/^(tunnel|road|bridge)_motorway(_link)?_casing$/, "line-color", "#eab54d"],
  // Main roads: pale yellow.
  [/^(tunnel|road|bridge)_trunk_primary$/, "line-color", "#fff4b8"],
  [/^(tunnel|road|bridge)_trunk_primary_casing$/, "line-color", "#e6cf86"],
  // Everything else: white streets with a thin grey edge.
  [/^(tunnel|road|bridge)_(secondary_tertiary|link|minor|street|service_track)$/, "line-color", "#ffffff"],
  [/^(tunnel|road|bridge)_(secondary_tertiary|link|minor|street|service_track)_casing$/, "line-color", "#d6d6d4"],
];

// Same public OSRM demo server the backend uses. Development only (~1 req/s).
const OSRM_URL = "https://router.project-osrm.org/route/v1/driving";

/** Decodes a Google/OSRM encoded polyline (precision 5) into points. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    for (const axis of [0, 1]) {
      let result = 0;
      let shift = 0;
      let byte: number;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 0) lat += delta;
      else lng += delta;
    }
    points.push({ latitude: lat / 1e5, longitude: lng / 1e5 });
  }
  return points;
}

const EARTH_RADIUS_M = 6_371_000;
const rad = (deg: number) => (deg * Math.PI) / 180;

export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLng = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Compass bearing from a to b, 0 = north, clockwise, in degrees. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.longitude - a.longitude)) * Math.cos(rad(b.latitude));
  const x =
    Math.cos(rad(a.latitude)) * Math.sin(rad(b.latitude)) -
    Math.sin(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.cos(rad(b.longitude - a.longitude));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return { latitude: a.latitude + (b.latitude - a.latitude) * t, longitude: a.longitude + (b.longitude - a.longitude) * t };
}

/** Total length of a path in meters. */
export function pathLength(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceMeters(path[i - 1]!, path[i]!);
  return total;
}

/** The point `meters` along a path (clamped to its ends), and the direction of travel there. */
export function pointAlong(path: LatLng[], meters: number): { point: LatLng; bearing: number } {
  if (path.length === 0) throw new Error("Empty path");
  if (path.length === 1 || meters <= 0) {
    return { point: path[0]!, bearing: path.length > 1 ? bearing(path[0]!, path[1]!) : 0 };
  }
  let left = meters;
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]!;
    const b = path[i]!;
    const segment = distanceMeters(a, b);
    if (left <= segment) return { point: lerp(a, b, segment === 0 ? 0 : left / segment), bearing: bearing(a, b) };
    left -= segment;
  }
  const last = path[path.length - 1]!;
  return { point: last, bearing: bearing(path[path.length - 2]!, last) };
}

export interface RoadRoute {
  path: LatLng[];
  distanceKm: number;
  durationMinutes: number;
  /** false = OSRM unavailable, `path` is a straight line. */
  onRoads: boolean;
}

/**
 * Driving route between two points via OSRM, straight-line fallback when the
 * routing server is unreachable (same idea as the backend's RouteService).
 */
export async function fetchRoute(from: LatLng, to: LatLng, signal?: AbortSignal): Promise<RoadRoute> {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  try {
    const res = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=polyline`, { signal });
    if (!res.ok) throw new Error(`OSRM ${res.status}`);
    const json = (await res.json()) as { routes?: { geometry: string; distance: number; duration: number }[] };
    const best = json.routes?.[0];
    if (!best) throw new Error("No route");
    return {
      path: decodePolyline(best.geometry),
      distanceKm: best.distance / 1000,
      durationMinutes: best.duration / 60,
      onRoads: true,
    };
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    const km = (distanceMeters(from, to) / 1000) * 1.3;
    return { path: [from, to], distanceKm: km, durationMinutes: (km / 25) * 60, onRoads: false };
  }
}
