/**
 * Build-time stand-in for satellite.js's optional WebAssembly runtimes.
 *
 * OVERHEAD only uses satellite.js's pure-JS SGP4 (`sgp4`, `json2satrec`,
 * `gstime`, …). The package's index also re-exports a WASM bulk-propagation
 * API whose multi-threaded build spawns workers from itself and imports
 * `node:worker_threads`, which bundlers cannot follow and which would add
 * ~400 KB of dead code. `next.config.ts` aliases both WASM entry points here.
 */
export default function unavailable(): never {
  throw new Error("satellite.js WASM runtimes are not bundled in OVERHEAD");
}
