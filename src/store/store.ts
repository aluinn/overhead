import { useSyncExternalStore } from "react";

type Listener = () => void;

/** A ~20-line observable store; avoids pulling in a state library for one object. */
export class Store<S extends object> {
  private listeners = new Set<Listener>();
  constructor(private state: S) {}

  get = (): S => this.state;

  set = (patch: Partial<S> | ((s: S) => Partial<S>)): void => {
    const next = typeof patch === "function" ? patch(this.state) : patch;
    let changed = false;
    for (const k of Object.keys(next) as Array<keyof S>) {
      if (!Object.is(this.state[k], next[k as keyof typeof next])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...next };
    for (const l of this.listeners) l();
  };

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };
}

/** Select a slice of a store; re-renders only when it changes (Object.is). */
export function useStore<S extends object, T>(store: Store<S>, selector: (s: S) => T): T {
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.get()),
    () => selector(store.get()),
  );
}
