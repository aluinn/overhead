"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { PositionStream } from "@/lib/three/positionStream";
import { Clock } from "@/lib/utils/clock";
import { PropagatorClient } from "@/lib/utils/rpc";
import type { ObjectInfo } from "@/lib/orbital/propagate";
import type { CompactGp, DataSource, ObjectKind } from "@/types";
import { Store, useStore } from "./store";

/** Immutable description of the loaded catalog, index-aligned with the worker. */
export interface Catalog {
  count: number;
  ids: Int32Array;
  names: string[];
  kinds: Uint8Array;
  gps: CompactGp[];
  /** Count of objects per `ObjectKind`. */
  perKind: Record<ObjectKind, number>;
}

export interface AppState {
  status: "loading" | "ready" | "error";
  dataSource: DataSource | null;
  catalog: Catalog | null;
  selected: number | null;
  hovered: number | null;
  showTrail: boolean;
  /** Info for the selected object, refreshed while selected. */
  info: ObjectInfo | null;
}

const initialState: AppState = {
  status: "loading",
  dataSource: null,
  catalog: null,
  selected: null,
  hovered: null,
  showTrail: true,
  info: null,
};

/** Everything long-lived: created once on the client, shared via context. */
export class Runtime {
  readonly store = new Store<AppState>(initialState);
  readonly clock = new Clock();
  client: PropagatorClient | null = null;
  stream: PositionStream | null = null;

  init(): void {
    if (this.client) return;
    this.client = new PropagatorClient();
    this.stream = new PositionStream(this.clock, this.client);
    this.stream.start();
  }

  dispose(): void {
    this.stream?.stop();
    this.client?.terminate();
    this.client = null;
    this.stream = null;
  }
}

const RuntimeContext = createContext<Runtime | null>(null);

export function RuntimeProvider({ children }: { children: ReactNode }) {
  const [runtime] = useState(() => new Runtime());
  useEffect(() => {
    runtime.init();
    return () => runtime.dispose();
  }, [runtime]);
  return <RuntimeContext value={runtime}>{children}</RuntimeContext>;
}

export function useRuntime(): Runtime {
  const rt = useContext(RuntimeContext);
  if (!rt) throw new Error("useRuntime must be used inside <RuntimeProvider>");
  return rt;
}

/** Select a slice of app state; re-renders only when it changes. */
export function useAppState<T>(selector: (s: AppState) => T): T {
  return useStore(useRuntime().store, selector);
}
