"use client";

import { useCallback, useEffect, useState } from "react";
import { loadSavedObserver, requestLocation, saveObserver, type GeoFailure } from "@/lib/geo/geolocation";
import { computeVisible, observerBasis } from "@/lib/orbital/lookAngles";
import { detectTrains, type PlaneElements } from "@/lib/orbital/trainDetection";
import { MIN_ELEVATION_DEG, useAppState, useRuntime } from "@/store/runtime";
import { ObjectKind, type Observer } from "@/types";

const SKY_INTERVAL_MS = 1000;
const TRAIN_INTERVAL_MS = 5000;

/**
 * Background analysis that runs for the life of the app:
 *  - once per second, which objects are above the observer's horizon
 *  - every few seconds, which Starlink satellites form trains
 * Both read the renderer's own position snapshots, so there's no extra SGP4 work.
 */
export function useSkyAnalysis(): void {
  const runtime = useRuntime();
  const observer = useAppState((s) => s.observer);
  const catalog = useAppState((s) => s.catalog);

  // Restore a previously chosen location (if any) on first mount.
  useEffect(() => {
    const saved = loadSavedObserver();
    if (saved) runtime.store.set({ observer: saved });
  }, [runtime]);

  // Visible-set loop.
  useEffect(() => {
    const { store, stream } = runtime;
    if (!stream || !catalog) return;
    if (!observer) {
      store.set((s) => (s.sky.visible.count === 0 ? {} : { sky: { ...s.sky, visible: { ...s.sky.visible, count: 0 } } }));
      return;
    }
    const basis = observerBasis(observer.latDeg, observer.lonDeg, observer.altKm);
    const run = () => {
      if (stream.count !== catalog.count) return; // stream and catalog are mid-swap
      const visible = computeVisible(stream.prev, stream.next, stream.alpha(), stream.count, basis, MIN_ELEVATION_DEG);
      const byKind: Record<ObjectKind, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
      for (let k = 0; k < visible.count; k++) byKind[catalog.kinds[visible.indices[k]] as ObjectKind]++;
      store.set((s) => ({ sky: { visible, byKind, tick: s.sky.tick + 1 } }));
    };
    run();
    const id = window.setInterval(run, SKY_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [runtime, observer, catalog]);

  // Train detection loop.
  useEffect(() => {
    const { store, stream } = runtime;
    if (!stream || !catalog) return;

    const candidates: number[] = [];
    const planes: PlaneElements = {
      inclinationDeg: new Float32Array(catalog.count),
      raanDeg: new Float32Array(catalog.count),
      meanMotion: new Float32Array(catalog.count),
    };
    for (let i = 0; i < catalog.count; i++) {
      const gp = catalog.gps[i];
      planes.inclinationDeg[i] = gp[5];
      planes.raanDeg[i] = gp[6];
      planes.meanMotion[i] = gp[3];
      if (catalog.kinds[i] === ObjectKind.Starlink) candidates.push(i);
    }

    let scratch = new Float32Array(catalog.count * 3);
    const run = () => {
      if (stream.count !== catalog.count) return;
      if (scratch.length !== catalog.count * 3) scratch = new Float32Array(catalog.count * 3);
      const positions = stream.current(scratch);
      const trains = detectTrains(candidates, positions, planes);
      const trainOf = new Int16Array(catalog.count).fill(-1);
      for (const t of trains) for (const m of t.members) trainOf[m] = t.id;
      store.set({ trains, trainOf });
    };
    // Delay the first run slightly so the first propagate has landed.
    const first = window.setTimeout(run, 1500);
    const id = window.setInterval(run, TRAIN_INTERVAL_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [runtime, catalog]);
}

export type LocateStatus = "idle" | "locating" | GeoFailure;

/** Actions for entering / leaving "over my head" mode. */
export function useObserverActions() {
  const { store } = useRuntime();
  const [status, setStatus] = useState<LocateStatus>("idle");

  const setObserver = useCallback(
    (observer: Observer | null) => {
      store.set({ observer, pickerOpen: false });
      saveObserver(observer);
      setStatus("idle");
    },
    [store],
  );

  /** Ask the browser for a location; on any failure, open the manual picker. */
  const locate = useCallback(async () => {
    setStatus("locating");
    const res = await requestLocation();
    if (res.ok) {
      setObserver(res.observer);
    } else {
      setStatus(res.reason);
      store.set({ pickerOpen: true });
    }
  }, [setObserver, store]);

  return { status, locate, setObserver, openPicker: () => store.set({ pickerOpen: true }), closePicker: () => store.set({ pickerOpen: false }) };
}
