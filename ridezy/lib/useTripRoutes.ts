"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { distanceMeters, fetchRoute, type LatLng } from "./mapGeo";

/** Re-route the driver only after they leave the planned path by this much. */
const REROUTE_AFTER_M = 150;

/** The part of `path` still ahead of `from`: starts at `from`, skips points already passed. */
function remainingPath(path: LatLng[], from: LatLng): LatLng[] {
  let nearest = 0;
  let best = Infinity;
  path.forEach((point, i) => {
    const d = distanceMeters(point, from);
    if (d < best) {
      best = d;
      nearest = i;
    }
  });
  return [from, ...path.slice(nearest + 1)];
}

function nearestDistance(path: LatLng[], point: LatLng): number {
  return path.reduce((best, p) => Math.min(best, distanceMeters(p, point)), Infinity);
}

/**
 * Road routes for a ride map:
 * - `route`: pickup → destination (fetched once per pair of places);
 * - `driverRoute`: driver → current target (pickup before the trip, destination
 *   during it). Fetched once, then trimmed as the driver moves along it, and
 *   only re-fetched when the driver strays from it or the target changes, so
 *   the public routing server sees a request every few hundred metres at most.
 */
export function useTripRoutes(
  pickup: LatLng | null | undefined,
  destination: LatLng | null | undefined,
  driver: LatLng | null | undefined,
  target: LatLng | null | undefined,
) {
  const [route, setRoute] = useState<{ key: string; path: LatLng[] } | null>(null);
  const [planned, setPlanned] = useState<{ targetKey: string; path: LatLng[] } | null>(null);
  const fetching = useRef(false);

  const tripKey = pickup && destination ? `${pickup.latitude},${pickup.longitude}|${destination.latitude},${destination.longitude}` : null;
  const targetKey = target ? `${target.latitude},${target.longitude}` : null;

  useEffect(() => {
    if (!tripKey || !pickup || !destination) return;
    const controller = new AbortController();
    fetchRoute(pickup, destination, controller.signal)
      .then((r) => setRoute({ key: tripKey, path: r.path }))
      .catch(() => undefined);
    return () => controller.abort();
    // pickup/destination are captured through tripKey
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tripKey]);

  // Decide whether the driver needs a fresh route.
  const needsRoute =
    Boolean(driver && target && targetKey) &&
    (!planned || planned.targetKey !== targetKey || (driver ? nearestDistance(planned.path, driver) > REROUTE_AFTER_M : false));

  // Latest positions for the request below, without re-running it on every move.
  const latest = useRef({ driver, target });
  useEffect(() => {
    latest.current = { driver, target };
  });

  useEffect(() => {
    const { driver: from, target: to } = latest.current;
    if (!needsRoute || !from || !to || !targetKey || fetching.current) return;
    fetching.current = true;
    let active = true;
    fetchRoute(from, to)
      .then((r) => {
        if (active) setPlanned({ targetKey, path: r.path });
      })
      .catch(() => undefined)
      .finally(() => {
        fetching.current = false;
      });
    return () => {
      active = false;
    };
  }, [needsRoute, targetKey]);

  const driverRoute = useMemo(() => {
    if (!driver || !planned || planned.targetKey !== targetKey) return null;
    return remainingPath(planned.path, driver);
  }, [driver, planned, targetKey]);

  return { route: route && route.key === tripKey ? route.path : null, driverRoute };
}
