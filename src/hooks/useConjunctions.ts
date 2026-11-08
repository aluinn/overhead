"use client";

import { useEffect } from "react";
import { pickScanSubset } from "@/lib/orbital/conjunction";
import { useAppState, useRuntime, type Catalog, type ConjunctionView } from "@/store/runtime";
import { useWorker } from "./useWorker";
import type { Conjunction, ConjunctionResponse } from "@/types";

const SCAN_MAX_OBJECTS = 320;
const SCAN_WINDOW_MS = 6 * 3_600_000;
const SCAN_STEP_MS = 30_000;
const SCAN_THRESHOLD_KM = 120;

/** Resolve NORAD ids to catalog indices (-1 when the object isn't in our catalog). */
export function resolveConjunctions(items: Conjunction[], catalog: Catalog): ConjunctionView[] {
  const byId = new Map<number, number>();
  for (let i = 0; i < catalog.count; i++) byId.set(catalog.ids[i], i);
  return items.map((c) => ({ ...c, indexA: byId.get(c.noradId1) ?? -1, indexB: byId.get(c.noradId2) ?? -1 }));
}

/**
 * Loads the near-miss feed. Prefers CelesTrak SOCRATES (via /api/conjunctions).
 * If that is unreachable (the route answers with its bundled sample) or fails
 * outright, it computes close approaches among a subset of the catalog in the
 * worker instead, so the feed is never empty.
 */
export function useConjunctions(): void {
  const runtime = useRuntime();
  const getClient = useWorker();
  const catalog = useAppState((s) => s.catalog);
  const ready = useAppState((s) => s.status === "ready");
  const raw = useAppState((s) => s.conjunctionsRaw);

  // One fetch per page load.
  useEffect(() => {
    const { store } = runtime;
    const ctrl = new AbortController();
    store.set((s) => ({ conjunctions: { ...s.conjunctions, status: "loading" } }));
    fetch("/api/conjunctions", { signal: ctrl.signal })
      .then((r) => (r.ok ? (r.json() as Promise<ConjunctionResponse>) : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((body) => store.set({ conjunctionsRaw: body }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        console.warn("[conjunctions] feed unavailable:", err);
        // Treat like "upstream down": the effect below will compute locally.
        store.set({ conjunctionsRaw: { source: "sample", fetchedAt: new Date().toISOString(), conjunctions: [] } });
      });
    return () => ctrl.abort();
  }, [runtime]);

  // Resolve against the catalog; run the local fallback scan when SOCRATES gave us nothing real.
  useEffect(() => {
    if (!catalog || !ready || !raw) return;
    const { store } = runtime;

    if (raw.source !== "sample") {
      store.set({ conjunctions: { status: "ready", source: raw.source, scanned: 0, items: resolveConjunctions(raw.conjunctions, catalog) } });
      return;
    }

    // Fallback: wait for the catalog to settle (it grows as groups arrive), then scan.
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const client = getClient();
      if (!client) return;
      const subset = pickScanSubset(catalog.kinds, catalog.gps, SCAN_MAX_OBJECTS);
      client
        .call("scan", { indices: subset, startMs: Date.now(), durationMs: SCAN_WINDOW_MS, stepMs: SCAN_STEP_MS, thresholdKm: SCAN_THRESHOLD_KM, limit: 40 })
        .then(({ events, scanned }) => {
          if (cancelled) return;
          if (events.length === 0) throw new Error("scan found nothing");
          const items: Conjunction[] = events.map((e) => ({
            id: `${catalog.ids[e.indexA]}-${catalog.ids[e.indexB]}-${Math.round(e.tcaMs)}`,
            noradId1: catalog.ids[e.indexA],
            name1: catalog.names[e.indexA],
            noradId2: catalog.ids[e.indexB],
            name2: catalog.names[e.indexB],
            tcaMs: e.tcaMs,
            rangeKm: e.rangeKm,
            relSpeedKmS: e.relSpeedKmS,
            maxProbability: null,
          }));
          store.set({ conjunctions: { status: "ready", source: "computed", scanned, items: resolveConjunctions(items, catalog) } });
        })
        .catch(() => {
          if (cancelled) return;
          // Nothing computed: show the bundled sample events so the feed isn't blank.
          store.set({ conjunctions: { status: "ready", source: "sample", scanned: 0, items: resolveConjunctions(raw.conjunctions, catalog) } });
        });
    }, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [runtime, getClient, catalog, ready, raw]);
}
