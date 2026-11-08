/// <reference lib="webworker" />
import type { SatRec } from "satellite.js";
import { fillScenePositions, inspectObject, sampleTrail, satrecFromCompact } from "@/lib/orbital/propagate";
import type { CatalogObject } from "@/types";
import type { RequestType, Requests, Responses, WorkerRequest, WorkerResponse } from "./messages";

declare const self: DedicatedWorkerGlobalScope;

/** Objects propagated per slice before yielding to the event loop. */
const BATCH_SIZE = 4096;

interface Catalog {
  objects: CatalogObject[];
  sats: Array<SatRec | null>;
}

let catalog: Catalog = { objects: [], sats: [] };

/** Yield so queued messages (inspect, trail, …) aren't starved by a long propagate. */
const yieldToEventLoop = (): Promise<void> =>
  new Promise((resolve) => {
    const ch = new MessageChannel();
    ch.port1.onmessage = () => resolve();
    ch.port2.postMessage(null);
  });

type Handlers = {
  [K in RequestType]: (payload: Requests[K]) => Promise<{ result: Responses[K]; transfer?: Transferable[] }>;
};

const handlers: Handlers = {
  async load({ objects }) {
    const sats: Array<SatRec | null> = new Array(objects.length);
    let valid = 0;
    for (let i = 0; i < objects.length; i++) {
      const sat = satrecFromCompact(objects[i].gp);
      sats[i] = sat;
      if (sat) valid++;
    }
    catalog = { objects, sats };
    return { result: { count: objects.length, valid, kinds: objects.map((o) => o.kind) } };
  },

  async propagate({ timeMs, buffer }) {
    const { sats } = catalog;
    // Re-allocate if the caller's recycled buffer predates a catalog change.
    const needed = sats.length * 3 * 4;
    const out = buffer.byteLength === needed ? new Float32Array(buffer) : new Float32Array(sats.length * 3);

    for (let start = 0; start < sats.length; start += BATCH_SIZE) {
      fillScenePositions(sats, timeMs, out, start, Math.min(start + BATCH_SIZE, sats.length));
      if (start + BATCH_SIZE < sats.length) await yieldToEventLoop();
    }
    return { result: { timeMs, buffer: out.buffer }, transfer: [out.buffer] };
  },

  async inspect({ index, timeMs }) {
    const sat = catalog.sats[index];
    const obj = catalog.objects[index];
    return { result: { info: sat && obj ? inspectObject(sat, obj.gp, timeMs) : null } };
  },

  async trail({ index, startMs, spanMs, steps }) {
    const sat = catalog.sats[index];
    const positions = sat ? sampleTrail(sat, startMs, spanMs, steps) : new Float32Array(0);
    return { result: { positions }, transfer: [positions.buffer] };
  },
};

async function dispatch(msg: WorkerRequest): Promise<void> {
  // The union of handlers can't be narrowed by `msg.type` alone; this cast is
  // sound because `WorkerRequest` pairs each `type` with its own payload.
  const handler = handlers[msg.type] as (payload: unknown) => Promise<{ result: unknown; transfer?: Transferable[] }>;
  try {
    const { result, transfer } = await handler(msg.payload);
    const response = { id: msg.id, type: msg.type, ok: true, payload: result } as WorkerResponse;
    self.postMessage(response, transfer ?? []);
  } catch (err) {
    const failure: WorkerResponse = { id: msg.id, ok: false, error: err instanceof Error ? err.message : String(err) };
    self.postMessage(failure);
  }
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  void dispatch(event.data);
};
