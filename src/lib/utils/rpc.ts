import type { RequestType, Requests, Responses, WorkerRequest, WorkerResponse } from "@/workers/messages";

interface Pending {
  resolve: (payload: never) => void;
  reject: (err: Error) => void;
}

/** Promise-based, fully typed RPC over the propagator worker. */
export class PropagatorClient {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL("../../workers/propagator.worker.ts", import.meta.url), { type: "module" });
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const msg = event.data;
      const p = this.pending.get(msg.id);
      if (!p) return;
      this.pending.delete(msg.id);
      if (msg.ok) p.resolve(msg.payload as never);
      else p.reject(new Error(msg.error));
    };
    this.worker.onerror = (event) => {
      const err = new Error(event.message || "Worker crashed");
      for (const p of this.pending.values()) p.reject(err);
      this.pending.clear();
    };
  }

  call<K extends RequestType>(type: K, payload: Requests[K], transfer: Transferable[] = []): Promise<Responses[K]> {
    const id = this.nextId++;
    return new Promise<Responses[K]>((resolve, reject) => {
      this.pending.set(id, { resolve: resolve as (payload: never) => void, reject });
      const msg = { id, type, payload } as WorkerRequest;
      this.worker.postMessage(msg, transfer);
    });
  }

  terminate(): void {
    this.worker.terminate();
    for (const p of this.pending.values()) p.reject(new Error("Worker terminated"));
    this.pending.clear();
  }
}
