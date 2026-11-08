/**
 * Typed protocol between the main thread and propagator.worker.ts.
 *
 * Every call is request/response keyed by a numeric id. `Requests[K]` is the
 * payload the main thread sends, `Responses[K]` what the worker answers with.
 * Adding a message means adding one entry to each map; the envelope types and
 * both ends of the RPC layer are derived from them.
 */
import type { CatalogObject, ObjectKind } from "@/types";
import type { LocalConjunction, PairState } from "@/lib/orbital/conjunction";
import type { ObjectInfo } from "@/lib/orbital/propagate";

export interface Requests {
  /** Replace the worker's catalog. Indices in all later messages refer to this order. */
  load: { objects: CatalogObject[] };

  /**
   * Fill `buffer` (Float32Array of 3×count, scene-space Earth radii) with
   * positions at `timeMs`. The buffer is *transferred* both ways, so the
   * caller must hand it back to be reused.
   */
  propagate: { timeMs: number; buffer: ArrayBuffer };

  /** Altitude, speed, lat/lon and orbit shape for one object. */
  inspect: { index: number; timeMs: number };

  /** Path of one object from `startMs` over `spanMs`, as scene-space points. */
  trail: { index: number; startMs: number; spanMs: number; steps: number };

  /** Positions of two objects at a time plus their separation (used to frame a conjunction). */
  pairState: { indexA: number; indexB: number; timeMs: number };

  /**
   * Fallback close-approach search among a subset of the catalog (used when
   * SOCRATES is unreachable). Indices refer to the loaded catalog.
   */
  scan: { indices: number[]; startMs: number; durationMs: number; stepMs: number; thresholdKm: number; limit: number };
}

export interface Responses {
  load: { count: number; valid: number; kinds: ObjectKind[] };
  propagate: { timeMs: number; buffer: ArrayBuffer };
  inspect: { info: ObjectInfo | null };
  trail: { positions: Float32Array };
  pairState: { state: PairState | null };
  scan: { events: LocalConjunction[]; scanned: number };
}

export type RequestType = keyof Requests;

export type WorkerRequest = {
  [K in RequestType]: { id: number; type: K; payload: Requests[K] };
}[RequestType];

export type WorkerSuccess = {
  [K in RequestType]: { id: number; type: K; ok: true; payload: Responses[K] };
}[RequestType];

export interface WorkerFailure {
  id: number;
  ok: false;
  error: string;
}

export type WorkerResponse = WorkerSuccess | WorkerFailure;
