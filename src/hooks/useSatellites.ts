"use client";

import { useEffect } from "react";
import { type Catalog, type Runtime, useRuntime } from "@/store/runtime";
import {
  GP_GROUPS,
  ObjectKind,
  type CatalogObject,
  type CompactGp,
  type DataSource,
  type GpGroup,
  type GpResponse,
} from "@/types";

const GROUPS = Object.keys(GP_GROUPS) as GpGroup[];

interface SampleFile {
  groups: Partial<Record<GpGroup, CompactGp[]>>;
}

/** Merge groups into one catalog; when an object is in several groups the highest-priority kind wins. */
export function mergeGroups(groups: Partial<Record<GpGroup, CompactGp[]>>): CatalogObject[] {
  const byId = new Map<number, CatalogObject>();
  for (const group of GROUPS) {
    for (const gp of groups[group] ?? []) {
      // The `active` group also lists Starlinks; classify by name so they never show up as plain satellites.
      const kind = GP_GROUPS[group] === ObjectKind.Other && gp[1].startsWith("STARLINK") ? ObjectKind.Starlink : GP_GROUPS[group];
      const existing = byId.get(gp[0]);
      if (!existing) byId.set(gp[0], { gp, kind });
      else if (kind > existing.kind) byId.set(gp[0], { gp: existing.gp, kind });
    }
  }
  return [...byId.values()];
}

function buildCatalog(objects: CatalogObject[]): Catalog {
  const count = objects.length;
  const ids = new Int32Array(count);
  const kinds = new Uint8Array(count);
  const names: string[] = new Array(count);
  const gps: CompactGp[] = new Array(count);
  const perKind: Record<ObjectKind, number> = {
    [ObjectKind.Other]: 0,
    [ObjectKind.Debris]: 0,
    [ObjectKind.Starlink]: 0,
    [ObjectKind.Station]: 0,
  };
  for (let i = 0; i < count; i++) {
    const o = objects[i];
    ids[i] = o.gp[0];
    names[i] = o.gp[1];
    kinds[i] = o.kind;
    gps[i] = o.gp;
    perKind[o.kind]++;
  }
  return { count, ids, names, kinds, gps, perKind };
}

/**
 * Loads every CelesTrak group through our own /api routes, merges them and
 * pushes the catalog into the worker. Groups apply progressively (coalesced),
 * so Starlink/stations appear while the big `active` set is still downloading.
 */
export function useSatellites(): void {
  const runtime = useRuntime();
  useEffect(() => {
    const ctrl = new AbortController();
    void loadAll(runtime, ctrl.signal);
    return () => ctrl.abort();
  }, [runtime]);
}

async function loadAll(runtime: Runtime, signal: AbortSignal): Promise<void> {
  const { store } = runtime;
  // Child effects run before the provider's, so make sure the worker exists.
  runtime.init();
  const client = runtime.client;
  const stream = runtime.stream;
  if (!client || !stream) return;

  const groups: Partial<Record<GpGroup, CompactGp[]>> = {};
  const sources: DataSource[] = [];
  let applying = false;
  let dirty = false;

  const apply = async (): Promise<void> => {
    if (applying) {
      dirty = true;
      return;
    }
    applying = true;
    try {
      do {
        dirty = false;
        const objects = mergeGroups(groups);
        if (objects.length === 0) continue;
        const res = await client.call("load", { objects });
        if (signal.aborted) return;
        const catalog = buildCatalog(objects);
        stream.setCount(res.count);
        const source: DataSource = sources.includes("sample")
          ? "sample"
          : sources.includes("stale-cache")
            ? "stale-cache"
            : "celestrak";
        store.set({ catalog, status: "ready", dataSource: source });
      } while (dirty);
    } finally {
      applying = false;
    }
  };

  const results = await Promise.allSettled(
    GROUPS.map(async (group) => {
      const res = await fetch(`/api/gp/${group}`, { signal });
      if (!res.ok) throw new Error(`${group}: HTTP ${res.status}`);
      const body = (await res.json()) as GpResponse;
      groups[group] = body.records;
      sources.push(body.source);
      await apply();
    }),
  );
  if (signal.aborted) return;

  // Every API call failed (offline, or the server is down): use the static sample.
  if (results.every((r) => r.status === "rejected")) {
    try {
      const res = await fetch("/data/sample-gp.json", { signal });
      const sample = (await res.json()) as SampleFile;
      Object.assign(groups, sample.groups);
      sources.push("sample");
      await apply();
    } catch (err) {
      if (!signal.aborted) {
        console.error("[satellites] no data available", err);
        store.set({ status: "error" });
      }
    }
  }
}
