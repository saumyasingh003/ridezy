"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchRoute, pathLength, pointAlong, type LatLng } from "./mapGeo";

/*
 * Drive simulator for testing on one machine: moves the driver along the real
 * road route to a target and reports each position (the page sends it to
 * PATCH /api/drivers/location, exactly like browser GPS would). Everything
 * downstream (backend, the passenger's live map, ETA) is the real thing.
 */

export const SIM_SPEEDS = [
  { id: 1, label: "1×" },
  { id: 5, label: "5×" },
  { id: 10, label: "10×" },
] as const;
export type SimSpeed = (typeof SIM_SPEEDS)[number]["id"];

/** Base speed: average city traffic. */
const BASE_KMH = 30;
/** How often a position is sent (well inside the 120/min location rate limit). */
const TICK_MS = 2000;

export interface SimulationState {
  running: boolean;
  /** 0..1 along the current route. */
  progress: number;
  remainingKm: number;
  error: string;
}

export function useDriveSimulation({
  onPosition,
  onArrive,
}: {
  /** Send the position (PATCH /drivers/location). Throwing stops the simulation. */
  onPosition: (point: LatLng) => Promise<void>;
  onArrive: () => void;
}) {
  const [state, setState] = useState<SimulationState>({ running: false, progress: 0, remainingKm: 0, error: "" });
  const [speed, setSpeed] = useState<SimSpeed>(5);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const speedRef = useRef(speed);
  const callbacks = useRef({ onPosition, onArrive });
  useEffect(() => {
    speedRef.current = speed;
    callbacks.current = { onPosition, onArrive };
  });

  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setState((s) => ({ ...s, running: false }));
  }, []);

  const start = useCallback(
    async (from: LatLng, to: LatLng) => {
      stop();
      setState({ running: true, progress: 0, remainingKm: 0, error: "" });
      const route = await fetchRoute(from, to).catch(() => null);
      if (!route) {
        setState({ running: false, progress: 0, remainingKm: 0, error: "Couldn't plan a route." });
        return;
      }
      const total = pathLength(route.path);
      let travelled = 0;
      let busy = false;

      const tick = async () => {
        if (busy) return; // previous update still in flight
        busy = true;
        travelled = Math.min(total, travelled + ((BASE_KMH * speedRef.current) / 3.6) * (TICK_MS / 1000));
        const { point } = pointAlong(route.path, travelled);
        try {
          await callbacks.current.onPosition(point);
        } catch (err) {
          stop();
          setState((s) => ({ ...s, error: (err as Error).message || "Location update failed." }));
          return;
        } finally {
          busy = false;
        }
        const done = travelled >= total;
        setState({ running: !done, progress: total ? travelled / total : 1, remainingKm: (total - travelled) / 1000, error: "" });
        if (done) {
          stop();
          callbacks.current.onArrive();
        }
      };

      await tick(); // first step right away
      if (travelled < total) timer.current = setInterval(() => void tick(), TICK_MS);
    },
    [stop],
  );

  // Never leave a timer running after the page unmounts.
  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  return { ...state, speed, setSpeed, start, stop };
}
