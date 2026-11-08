"use client";

import { useCallback } from "react";
import type { PropagatorClient } from "@/lib/utils/rpc";
import { useRuntime } from "@/store/runtime";

/**
 * Access to the propagation worker. Returns a stable getter rather than the
 * client itself: the worker is created in an effect (it doesn't exist during
 * SSR or the first render), so call `getClient()` from effects and handlers.
 */
export function useWorker(): () => PropagatorClient | null {
  const runtime = useRuntime();
  return useCallback(() => {
    runtime.init();
    return runtime.client;
  }, [runtime]);
}
