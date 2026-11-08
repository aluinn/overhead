"use client";

import { useEffect, useState } from "react";
import type { Clock } from "@/lib/utils/clock";
import { useRuntime } from "@/store/runtime";

export interface ClockView {
  simMs: number;
  /** Sim time minus real time, ms. */
  offsetMs: number;
  speed: number;
  isLive: boolean;
}

function snapshot(clock: Clock): ClockView {
  const simMs = clock.now();
  return { simMs, offsetMs: simMs - Date.now(), speed: clock.speed, isLive: clock.isLive };
}

/**
 * Re-renders a few times per second with the current sim time; for HUD
 * readouts only. Returns null until mounted so server and first client render
 * agree (time-dependent output would otherwise cause a hydration mismatch).
 */
export function useClockView(intervalMs = 250): ClockView | null {
  const { clock } = useRuntime();
  const [view, setView] = useState<ClockView | null>(null);
  useEffect(() => {
    const tick = () => {
      const next = snapshot(clock);
      setView((prev) =>
        prev && prev.speed === next.speed && prev.isLive === next.isLive && Math.abs(prev.simMs - next.simMs) < 200 ? prev : next,
      );
    };
    tick();
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [clock, intervalMs]);
  return view;
}
