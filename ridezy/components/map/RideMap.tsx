"use client";

import { useEffect, useRef, useState } from "react";
import type { GeoJSONSource, Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Hand, LocateFixed } from "lucide-react";
import { bearing, distanceMeters, lerp, MAP_COLOURS, MAP_STYLE_URL, type LatLng } from "@/lib/mapGeo";

/*
 * Real street map (MapLibre GL + OpenFreeMap vector tiles, no API key).
 * Draws the trip route, pickup/drop markers and a driver marker that glides
 * smoothly between location updates instead of jumping.
 */

export interface RideMapProps {
  /** With an `address`, a name label is shown next to the pin. */
  pickup?: MapPlace | null;
  destination?: MapPlace | null;
  /** Trip route (pickup → destination), solid. */
  route?: LatLng[] | null;
  /** Driver's position, or null to hide the car. */
  driver?: LatLng | null;
  /** Driver → current target (pickup or destination), dashed. */
  driverRoute?: LatLng[] | null;
  /** Change this to re-fit the view to everything on the map. */
  fitKey?: string;
  /** Keep the car in view as it moves. */
  followDriver?: boolean;
  className?: string;
}

export type MapPlace = LatLng & { address?: string };

/** "Patna Junction, Station Road, Patna" → "Patna Junction" (kept short for the map label). */
function shortName(address: string): string {
  const first = address.split(",")[0]?.trim() || address.trim();
  return first.length > 28 ? `${first.slice(0, 27)}…` : first;
}

/** How far one arrow-button press moves the map, in pixels. */
const PAN_PX = 140;

const FALLBACK_CENTER: [number, number] = [85.1376, 25.5941]; // Patna
const toLngLat = (p: LatLng): [number, number] => [p.longitude, p.latitude];
const line = (path: LatLng[] | null | undefined) => ({
  type: "Feature" as const,
  properties: {},
  geometry: { type: "LineString" as const, coordinates: (path ?? []).map(toLngLat) },
});

const PIN_COLORS = {
  pickup: { fill: "#16A34A", stroke: "#0F7A35", dot: "#15803D", halo: "rgba(22,163,74,.28)" },
  destination: { fill: "#E53935", stroke: "#B71C1C", dot: "#C62828", halo: "rgba(229,57,53,.28)" },
} as const;

/**
 * Location pin (green pickup, red drop) with a pulsing halo around its tip and
 * an optional name label. Anchored at the tip (anchor: "bottom").
 */
function pinElement(kind: keyof typeof PIN_COLORS, label?: string): HTMLElement {
  const c = PIN_COLORS[kind];
  const el = document.createElement("div");
  el.setAttribute("aria-hidden", "true");
  el.style.cssText = "position:relative;width:34px;height:44px;";
  el.innerHTML = `
    <span class="ridezy-pin-halo" style="position:absolute;left:50%;bottom:-36px;width:72px;height:72px;margin-left:-36px;border-radius:9999px;background:${c.halo}"></span>
    <span style="position:absolute;left:50%;bottom:-4px;width:9px;height:9px;margin-left:-4.5px;border-radius:9999px;background:${c.dot};box-shadow:0 0 0 2px #fff"></span>
    <svg width="34" height="44" viewBox="0 0 34 44" style="position:relative;filter:drop-shadow(0 3px 4px rgba(0,0,0,.35))">
      <path d="M17 43C17 43 32 27.5 32 16.5C32 7.9 25.3 1 17 1S2 7.9 2 16.5C2 27.5 17 43 17 43Z" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>
      <circle cx="17" cy="16.5" r="6.5" fill="#fff"/>
    </svg>`;
  if (label) {
    const tag = document.createElement("span");
    tag.textContent = label; // text, never HTML: addresses are user-provided
    tag.style.cssText =
      "position:absolute;left:40px;top:3px;white-space:nowrap;background:#fff;color:#111;font:700 13px/1 Arial,Helvetica,sans-serif;padding:8px 12px;border-radius:10px;box-shadow:0 6px 18px rgba(0,0,0,.18);border:1px solid rgba(0,0,0,.06)";
    el.appendChild(tag);
  }
  return el;
}

/** Top-down white car pointing north; the marker's rotation turns it to the heading. */
function carElement(): HTMLElement {
  const el = document.createElement("div");
  el.setAttribute("aria-label", "Driver");
  el.style.cssText = "width:28px;height:52px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.4))";
  el.innerHTML = `
    <svg width="28" height="52" viewBox="0 0 28 52">
      <rect x="1.5" y="1.5" width="25" height="49" rx="9" fill="#ffffff" stroke="#c9c9c9" stroke-width="1"/>
      <path d="M5 15 Q14 10 23 15 L21.5 21 Q14 18.5 6.5 21 Z" fill="#1f1f1f"/>
      <rect x="6.5" y="22" width="15" height="12" rx="3" fill="#f3f3f3" stroke="#dedede" stroke-width=".8"/>
      <path d="M6.5 37 Q14 39.5 21.5 37 L22.5 42 Q14 45 5.5 42 Z" fill="#1f1f1f"/>
      <path d="M4.5 21.5 L4.5 35.5 M23.5 21.5 L23.5 35.5" stroke="#2b2b2b" stroke-width="1.6" stroke-linecap="round"/>
      <rect x="5" y="2.5" width="5" height="2.5" rx="1.2" fill="#ffe082"/>
      <rect x="18" y="2.5" width="5" height="2.5" rx="1.2" fill="#ffe082"/>
      <rect x="4.5" y="47" width="5.5" height="2.5" rx="1.2" fill="#e53935"/>
      <rect x="18" y="47" width="5.5" height="2.5" rx="1.2" fill="#e53935"/>
    </svg>`;
  return el;
}

export default function RideMap({
  pickup,
  destination,
  route,
  driver,
  driverRoute,
  fitKey,
  followDriver = false,
  className = "",
}: RideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const libRef = useRef<typeof import("maplibre-gl") | null>(null);
  const markers = useRef<{ pickup?: Marker; destination?: Marker; driver?: Marker }>({});
  const pinLabels = useRef<{ pickup?: string; destination?: string }>({});
  const driverAnim = useRef<{ shown: LatLng | null; frame: number | null }>({ shown: null, frame: null });
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  // "Drag to move" hint: shown until the user moves the map (or for a few seconds).
  const [showHint, setShowHint] = useState(true);

  // Create the map once (client only: MapLibre needs the DOM and WebGL).
  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    const anim = driverAnim.current;
    const placed = markers.current;
    void import("maplibre-gl")
      .then((lib) => {
        if (cancelled || !containerRef.current) return;
        libRef.current = lib;
        map = new lib.Map({
          container: containerRef.current,
          style: MAP_STYLE_URL,
          center: FALLBACK_CENTER,
          zoom: 12,
          attributionControl: { compact: true },
        });
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        map.on("load", () => {
          if (cancelled || !map) return;
          // Recolour the base map (Google-Maps-like); unknown layers are left as they are.
          for (const layer of map.getStyle().layers) {
            for (const [pattern, property, colour] of MAP_COLOURS) {
              // Only a property of the layer's own type (a "line-color" on a line layer, ...).
              if (!pattern.test(layer.id) || !property.startsWith(`${layer.type}-`)) continue;
              try {
                map.setPaintProperty(layer.id, property, colour);
              } catch {
                // A style update renamed something: keep its original colour.
              }
            }
          }
          map.addSource("route", { type: "geojson", data: line(null) });
          map.addSource("driver-route", { type: "geojson", data: line(null) });
          map.addLayer({
            id: "route-casing",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#111111", "line-opacity": 0.15, "line-width": 10 },
          });
          map.addLayer({
            id: "route",
            type: "line",
            source: "route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#111111", "line-width": 4.5 },
          });
          map.addLayer({
            id: "driver-route",
            type: "line",
            source: "driver-route",
            layout: { "line-cap": "round", "line-join": "round" },
            paint: { "line-color": "#2563eb", "line-width": 4, "line-dasharray": [1.2, 1.6] },
          });
          mapRef.current = map;
          setReady(true);
          map.once("dragstart", () => setShowHint(false));
          window.setTimeout(() => setShowHint(false), 5000);
        });
        map.on("error", (e) => {
          // Tile hiccups are retried by MapLibre; only a failed style load is fatal.
          if (!map?.isStyleLoaded() && String(e.error?.message ?? "").includes("style")) setFailed(true);
        });
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      if (anim.frame) cancelAnimationFrame(anim.frame);
      map?.remove();
      mapRef.current = null;
      placed.pickup = placed.destination = placed.driver = undefined;
    };
  }, []);

  // Route lines.
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (mapRef.current.getSource("route") as GeoJSONSource | undefined)?.setData(line(route));
  }, [ready, route]);
  useEffect(() => {
    if (!ready || !mapRef.current) return;
    (mapRef.current.getSource("driver-route") as GeoJSONSource | undefined)?.setData(line(driverRoute));
  }, [ready, driverRoute]);

  // Pickup / destination markers.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    for (const kind of ["pickup", "destination"] as const) {
      const place = kind === "pickup" ? pickup : destination;
      const label = place?.address ? shortName(place.address) : undefined;
      const existing = markers.current[kind];
      if (existing && (!place || pinLabels.current[kind] !== label)) {
        existing.remove(); // gone, or renamed: rebuild with the new label
        markers.current[kind] = undefined;
      }
      if (!place) continue;
      if (markers.current[kind]) {
        markers.current[kind]!.setLngLat(toLngLat(place));
      } else {
        markers.current[kind] = new lib.Marker({ element: pinElement(kind, label), anchor: "bottom" })
          .setLngLat(toLngLat(place))
          .addTo(map);
        pinLabels.current[kind] = label;
      }
    }
  }, [ready, pickup, destination]);

  // Driver marker: glide from where it is shown to the new position.
  useEffect(() => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!ready || !map || !lib) return;
    const anim = driverAnim.current;
    if (anim.frame) cancelAnimationFrame(anim.frame);

    if (!driver) {
      markers.current.driver?.remove();
      markers.current.driver = undefined;
      anim.shown = null;
      return;
    }
    if (!markers.current.driver) {
      markers.current.driver = new lib.Marker({ element: carElement(), rotationAlignment: "map" })
        .setLngLat(toLngLat(driver))
        .addTo(map);
      anim.shown = driver;
      return;
    }

    const from = anim.shown ?? driver;
    const moved = distanceMeters(from, driver);
    if (moved > 3) markers.current.driver.setRotation(bearing(from, driver));
    // Big jumps (e.g. first fix after a reconnect) snap; normal updates glide.
    const duration = moved > 3000 ? 0 : 1800;
    const start = performance.now();
    const step = (now: number) => {
      const t = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      const eased = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const point = lerp(from, driver, eased);
      anim.shown = point;
      markers.current.driver?.setLngLat(toLngLat(point));
      if (followDriver && t === 1) map.easeTo({ center: toLngLat(point), duration: 600 });
      anim.frame = t < 1 ? requestAnimationFrame(step) : null;
    };
    anim.frame = requestAnimationFrame(step);
  }, [ready, driver, followDriver]);

  // Fit everything into view on first data and whenever fitKey changes.
  const fit = () => {
    const map = mapRef.current;
    const lib = libRef.current;
    if (!map || !lib) return;
    const points = [pickup, destination, driver, ...(route ?? []), ...(driverRoute ?? [])].filter(
      (p): p is LatLng => Boolean(p),
    );
    if (points.length === 0) return;
    if (points.length === 1) {
      map.easeTo({ center: toLngLat(points[0]!), zoom: 15, duration: 600 });
      return;
    }
    const bounds = new lib.LngLatBounds(toLngLat(points[0]!), toLngLat(points[0]!));
    for (const p of points) bounds.extend(toLngLat(p));
    // Extra room at the bottom for pin halos and on the right for the name labels.
    map.fitBounds(bounds, { padding: { top: 70, bottom: 80, left: 60, right: 150 }, maxZoom: 16, duration: 700 });
  };
  const fitRef = useRef(fit);
  useEffect(() => {
    fitRef.current = fit;
  });
  const hasData = Boolean(pickup || destination || driver);
  useEffect(() => {
    if (ready && hasData) fitRef.current();
  }, [ready, hasData, fitKey]);

  return (
    <div className={`relative overflow-hidden bg-[#F2F0EB] ${className}`}>
      {/* MapLibre sets position:relative on its container, so size it from a wrapper. */}
      <div className="absolute inset-0">
        <div ref={containerRef} className="h-full w-full [&_.maplibregl-canvas]:cursor-grab [&_.maplibregl-canvas:active]:cursor-grabbing" />
      </div>
      {!ready && !failed && (
        <div className="absolute inset-0 flex items-center justify-center text-xs text-[#7A7A7A]">Loading map…</div>
      )}
      {failed && (
        <div className="absolute inset-0 flex items-center justify-center px-6 text-center text-xs text-[#7A7A7A]">
          Map couldn&apos;t load. Check your internet connection.
        </div>
      )}
      {ready && (
        <div
          className="absolute right-2.5 top-[78px] grid grid-cols-3 gap-0.5 rounded-[6px] bg-white p-0.5 shadow-[0_0_0_2px_rgba(0,0,0,0.1)]"
          role="group"
          aria-label="Move map"
        >
          {(
            [
              { label: "Move map up", Icon: ChevronUp, by: [0, -PAN_PX], cell: "col-start-2" },
              { label: "Move map left", Icon: ChevronLeft, by: [-PAN_PX, 0], cell: "col-start-1 row-start-2" },
              { label: "Move map right", Icon: ChevronRight, by: [PAN_PX, 0], cell: "col-start-3 row-start-2" },
              { label: "Move map down", Icon: ChevronDown, by: [0, PAN_PX], cell: "col-start-2 row-start-3" },
            ] as const
          ).map(({ label, Icon, by, cell }) => (
            <button
              key={label}
              type="button"
              aria-label={label}
              title={label}
              onClick={() => mapRef.current?.panBy([by[0], by[1]], { duration: 300 })}
              className={`${cell} flex size-[22px] items-center justify-center rounded-[4px] text-[#111111] hover:bg-[#F0F0F0]`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      )}
      {ready && showHint && (
        <div className="pointer-events-none absolute left-1/2 top-3 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-[11px] font-semibold text-white">
          <Hand size={13} /> Drag to move the map
        </div>
      )}
      {ready && hasData && (
        <button
          type="button"
          aria-label="Re-centre map"
          title="Re-centre"
          onClick={fit}
          className="absolute bottom-8 right-2.5 flex size-[29px] items-center justify-center rounded-[4px] bg-white text-[#111111] shadow-[0_0_0_2px_rgba(0,0,0,0.1)] hover:bg-[#F4F4F4]"
        >
          <LocateFixed size={15} />
        </button>
      )}
    </div>
  );
}
