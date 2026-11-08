/**
 * Propagation benchmark. Measures the work the worker does each tick, on this machine:
 *
 *   npm run bench            (== node scripts/benchmark-propagation.ts)
 *
 * It reuses the bundled sample catalog and tiles it up to larger sizes by
 * perturbing mean anomaly, so the numbers don't depend on network access.
 * Runs on Node >= 22.6 (native TypeScript type stripping).
 */
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { computeVisible, observerBasis } from "../src/lib/orbital/lookAngles.ts";
import { fillScenePositions, satrecFromCompact } from "../src/lib/orbital/propagate.ts";
import { detectTrains, type PlaneElements } from "../src/lib/orbital/trainDetection.ts";
import type { CompactGp } from "../src/types/index.ts";

const sample = JSON.parse(readFileSync(path.join(import.meta.dirname, "..", "public", "data", "sample-gp.json"), "utf8")) as {
  groups: Record<string, CompactGp[]>;
};
const base: CompactGp[] = Object.values(sample.groups).flat();
const starlinkBase = sample.groups.starlink ?? [];

const SIZES = [1_000, 5_000, 10_000, 20_000, 40_000];
const PASSES = 25;
const BATCH = 4096; // same slice size as the worker

/** Tile the base catalog to `n` objects, rotating mean anomaly so positions are distinct. */
function tile(n: number): CompactGp[] {
  return Array.from({ length: n }, (_, i) => {
    const b = base[i % base.length];
    const k = Math.floor(i / base.length);
    const gp = [...b] as unknown as CompactGp[number][];
    gp[8] = (Number(b[8]) + k * 37.7) % 360;
    return gp as unknown as CompactGp;
  });
}

const median = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const p95 = (xs: number[]): number => [...xs].sort((a, b) => a - b)[Math.floor(xs.length * 0.95)];
const ms = (x: number): string => x.toFixed(x < 10 ? 2 : 1);

interface Row {
  objects: number;
  initMs: number;
  passMedianMs: number;
  passP95Ms: number;
  usPerObject: number;
  maxHz: number;
  visibleMs: number;
}

const observer = observerBasis(51.5074, -0.1278, 0);
const rows: Row[] = [];

for (const n of SIZES) {
  const gps = tile(n);

  const t0 = performance.now();
  const sats = gps.map(satrecFromCompact);
  const initMs = performance.now() - t0;

  const out = new Float32Array(n * 3);
  const now = Date.now();
  // Warm-up (JIT).
  for (let w = 0; w < 3; w++) fillScenePositions(sats, now, out);

  const passes: number[] = [];
  for (let p = 0; p < PASSES; p++) {
    const start = performance.now();
    for (let s = 0; s < n; s += BATCH) fillScenePositions(sats, now + p * 1000, out, s, Math.min(s + BATCH, n));
    passes.push(performance.now() - start);
  }

  // Look-angle filter over the same positions (runs on the main thread each second).
  const vis: number[] = [];
  for (let p = 0; p < PASSES; p++) {
    const start = performance.now();
    computeVisible(out, out, 0, n, observer, 10);
    vis.push(performance.now() - start);
  }

  const med = median(passes);
  rows.push({ objects: n, initMs, passMedianMs: med, passP95Ms: p95(passes), usPerObject: (med * 1000) / n, maxHz: 1000 / med, visibleMs: median(vis) });
}

// Train detection over a Starlink-sized candidate set.
const sl = Array.from({ length: 11_000 }, (_, i) => {
  const b = starlinkBase[i % starlinkBase.length];
  const gp = [...b] as unknown as number[];
  gp[8] = (Number(b[8]) + Math.floor(i / starlinkBase.length) * 13.7) % 360; // spread duplicates around the orbit
  return gp as unknown as CompactGp;
});
const slSats = sl.map(satrecFromCompact);
const slPos = new Float32Array(sl.length * 3);
fillScenePositions(slSats, Date.now(), slPos);
const planes: PlaneElements = {
  inclinationDeg: Float32Array.from(sl, (g) => g[5]),
  raanDeg: Float32Array.from(sl, (g) => g[6]),
  meanMotion: Float32Array.from(sl, (g) => g[3]),
};
const cand = sl.map((_, i) => i);
const trainTimes: number[] = [];
for (let i = 0; i < 10; i++) {
  const s = performance.now();
  detectTrains(cand, slPos, planes);
  trainTimes.push(performance.now() - s);
}

const cpu = os.cpus()[0]?.model ?? "unknown CPU";
console.log(`\nOVERHEAD propagation benchmark`);
console.log(`node ${process.version} · ${cpu} · ${os.cpus().length} cores · ${PASSES} passes, median [p95]\n`);
console.log("| objects | SGP4 init | propagate pass (median) | p95 | µs/object | max tick rate | look-angle filter |");
console.log("| ------: | --------: | ----------------------: | --: | --------: | ------------: | ----------------: |");
for (const r of rows) {
  console.log(
    `| ${r.objects.toLocaleString("en-US")} | ${ms(r.initMs)} ms | ${ms(r.passMedianMs)} ms | ${ms(r.passP95Ms)} ms | ${r.usPerObject.toFixed(2)} | ${Math.round(r.maxHz)} Hz | ${ms(r.visibleMs)} ms |`,
  );
}
console.log(`\nTrain detection, 11,000 Starlink candidates: ${ms(median(trainTimes))} ms (median of 10)`);
console.log(`Position buffer at 20,000 objects: ${((20_000 * 12) / 1024).toFixed(0)} KiB per snapshot (Float32 ×3)`);
