"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => undefined;

/**
 * True when the page is loaded with `?embed=1` (e.g. inside an iframe): the
 * HUD collapses to the globe, headline counter and hover/click cards.
 * The server snapshot is always false so hydration never mismatches.
 */
export function useEmbedMode(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => new URLSearchParams(window.location.search).has("embed"),
    () => false,
  );
}
