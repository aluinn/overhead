"use client";

import { useEffect, useId, useRef, useState } from "react";
import { type LocateStatus, useObserverActions } from "@/hooks/useObserver";
import { observerFromCity, observerFromCoords, parseLatLon, searchCities } from "@/lib/geo/cityLookup";
import { useAppState } from "@/store/runtime";

const MESSAGES: Record<LocateStatus, string | null> = {
  idle: null,
  locating: "Locating…",
  denied: "Location permission was denied. Pick a city or enter coordinates instead.",
  unavailable: "Couldn't determine your position. Pick a city or enter coordinates instead.",
  timeout: "Locating timed out. Pick a city or enter coordinates instead.",
  unsupported: "This browser has no geolocation. Pick a city or enter coordinates instead.",
};

/** Manual fallback: type a city or "lat, lon". Opens automatically when geolocation fails. */
export function LocationPicker() {
  const open = useAppState((s) => s.pickerOpen);
  const { status, locate, setObserver, closePicker } = useObserverActions();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closePicker();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, closePicker]);

  if (!open) return null;

  const coords = parseLatLon(query);
  const matches = coords ? [] : searchCities(query);
  const message = MESSAGES[status];

  const submit = () => {
    if (coords) setObserver(observerFromCoords(coords.lat, coords.lon));
    else if (matches[0]) setObserver(observerFromCity(matches[0]));
  };

  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={closePicker}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Choose your location"
        className="w-[min(92vw,380px)] rounded-sm border border-[var(--line)] bg-[#070b12]/95 p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between font-mono text-[10px] tracking-[0.2em] text-[var(--muted)]">
          <span>CHOOSE YOUR SKY</span>
          <button type="button" aria-label="Close" onClick={closePicker} className="hover:text-[var(--fg)]">
            ✕
          </button>
        </div>

        {message && (
          <p className={`mt-3 font-mono text-[11px] leading-relaxed ${status === "locating" ? "text-[var(--accent)]" : "text-[#ffc83d]"}`}>{message}</p>
        )}

        <button
          type="button"
          onClick={() => void locate()}
          disabled={status === "locating"}
          className="mt-4 w-full rounded-sm border border-[var(--accent)]/50 px-3 py-2 font-mono text-[11px] tracking-[0.16em] text-[var(--accent)] transition-colors hover:bg-[var(--accent)]/10 disabled:opacity-50"
        >
          ◎ USE MY LOCATION
        </button>

        <div className="my-4 flex items-center gap-3 font-mono text-[9px] tracking-[0.2em] text-[var(--muted)]">
          <span className="h-px flex-1 bg-[var(--line)]" />
          OR
          <span className="h-px flex-1 bg-[var(--line)]" />
        </div>

        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="City, or lat, lon (51.5, -0.12)"
          aria-label="City or coordinates"
          aria-controls={listId}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-sm border border-[var(--line)] bg-transparent px-3 py-2 font-mono text-[12px] text-[var(--fg)] outline-none placeholder:text-[var(--muted)]/70 focus:border-[var(--accent)]/60"
        />

        <ul id={listId} className="mt-2 max-h-48 overflow-auto">
          {coords && (
            <li>
              <button type="button" onClick={submit} className="w-full rounded-sm px-2 py-1.5 text-left font-mono text-[11px] text-[var(--fg)] hover:bg-white/5">
                Use {coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}
              </button>
            </li>
          )}
          {matches.map((c) => (
            <li key={`${c.name}-${c.country}`}>
              <button
                type="button"
                onClick={() => setObserver(observerFromCity(c))}
                className="flex w-full items-baseline justify-between rounded-sm px-2 py-1.5 text-left font-mono text-[11px] text-[var(--fg)] hover:bg-white/5"
              >
                {c.name}
                <span className="text-[9px] tracking-[0.14em] text-[var(--muted)]">{c.country.toUpperCase()}</span>
              </button>
            </li>
          ))}
          {query.trim() && !coords && matches.length === 0 && (
            <li className="px-2 py-1.5 font-mono text-[11px] text-[var(--muted)]">No match. Try a bigger city, or enter coordinates.</li>
          )}
        </ul>
      </div>
    </div>
  );
}
