# Performance

Goal: smooth 60 fps with 10,000+ objects, on a phone. The design keeps the expensive work (SGP4) off the main
thread and does the per-frame work (interpolation) on the GPU.

## Benchmarks

Measured by [`scripts/benchmark-propagation.ts`](../scripts/benchmark-propagation.ts) (`npm run bench`). It reuses the
bundled sample catalog tiled up with perturbed mean anomalies, so it needs no network. These are the exact functions
the worker and HUD run each tick.

**Machine:** Apple M1 Pro (8 cores), Node v24.20.0. Median of 25 passes after warm-up; `p95` shows the tail.

| objects | SGP4 init | propagate pass (median) |   p95 | µs/object | max tick rate | look-angle filter |
| ------: | --------: | ----------------------: | ----: | --------: | ------------: | ----------------: |
|   1,000 |   19.0 ms |                 0.50 ms | 0.59 ms |      0.50 |       1991 Hz |           0.04 ms |
|   5,000 |   27.9 ms |                 2.41 ms | 2.96 ms |      0.48 |        415 Hz |           0.15 ms |
|  10,000 |   40.6 ms |                 5.02 ms | 5.68 ms |      0.50 |        199 Hz |           0.33 ms |
|  20,000 |   79.6 ms |                 9.54 ms | 10.5 ms |      0.48 |        105 Hz |           0.56 ms |
|  40,000 |  131.9 ms |                 18.7 ms | 28.9 ms |      0.47 |         53 Hz |           1.13 ms |

Other measurements on the same machine:

- **Train detection**, 11,000 Starlink candidates: **23 ms** (median of 10), run every 5 s.
- **Position snapshot**: 234 KiB at 20,000 objects (Float32 × 3), transferred zero-copy.
- **Fallback conjunction scan**, 320 objects × 6 h at 30 s steps: about **0.8 s** end to end in a real browser
  (software WebGL), done once in the worker.
- **Client JavaScript**: about **350 KB gzipped** across all chunks, including three.js, satellite.js and the worker
  (the satellite.js WASM runtimes are stubbed out; see `next.config.ts`).
- **Static assets**: Earth textures 1.1 MB, sample dataset 168 KB.

Reading the table: the real catalog is ~19,000 objects, so one propagation pass costs **≈ 9 ms of worker time per
second**, under 1% of one core, and the tick rate has ~100× headroom. Even at 600× (4 ticks/s) it is ~4% of a core.
Scaling is linear (≈ 0.5 µs per object), so doubling the catalog doubles the cost, not more.

> Frame-rate numbers are deliberately not in this table: they depend on the GPU, and the automated browser here uses
> software WebGL. The CPU side is what this project controls, and it is the part measured above.

## Why it's fast

**1. SGP4 runs in a worker, in slices.** `propagate` processes the catalog in batches of 4,096 and yields to the
worker's event loop between batches (via `MessageChannel`), so a `trail` or `inspect` request never waits behind a full
pass. GMST and the Julian date are computed once per batch, and `sgp4()` is called directly instead of the `Date`-based
wrapper, which would redo calendar maths 19,000 times a tick.

**2. Zero-copy transfers.** The result buffer is *transferred* to the main thread and back, then reused as the next
request's scratch space: no allocation or copy per tick in steady state.

**3. The GPU interpolates.** The main thread keeps two snapshots (`prev`, `next`) and uploads them only when a tick
lands (~1 Hz). Every frame only a single uniform (`uAlpha`) changes; the vertex shader computes
`mix(aPrev, aNext, uAlpha)`. Per-frame CPU cost for 19,000 points is effectively constant.

**4. One draw call.** All objects are a single `THREE.Points` with a custom shader (per-vertex kind → colour/size,
flags for "above you" / train members, reticle for hover/selection). No per-object meshes, no per-object matrices.

**5. Tick rate follows sim speed.** At ≤ 60× a tick is 1 s; at 600× it is 250 ms, because linear interpolation across
a 600-s chord of a LEO orbit would cut through the Earth.

**6. Picking without raycasting.** Hover/click projects all points on the CPU once per pointer event (not per frame),
skipping those hidden behind the planet, ~19,000 matrix-vector products. `THREE.Raycaster` against a points cloud
would be far slower.

**7. The HUD doesn't re-render per frame.** The render loop reads the store imperatively; labels are DOM nodes moved with
`transform`. React updates ≈ 1 Hz (counter, list, radar).

**8. Mobile-aware.** Pixel ratio is capped at 2, the render loop pauses when the tab is hidden, and the globe falls
back to a wider FOV on tall screens.

## What you can still tune

- Debris and "other" points are the bulk of the count. If a low-end device struggles, reducing `uSizes` or skipping
  `Other`-kind points in `SatellitePoints` is a one-line change.
- The Earth textures are 2K. A 4K set would look sharper close-up at the cost of ~4× the download.

## Reproduce

```bash
npm run bench
```

Output is Markdown, ready to paste. Numbers vary by machine; please include the CPU line when posting results.
