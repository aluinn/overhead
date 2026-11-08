"use client";

import { useState, type ReactNode } from "react";

export interface PanelTab {
  id: string;
  label: string;
  content: ReactNode;
}

/**
 * Right-hand column on desktop; a bottom sheet on phones (tap the header to
 * expand/collapse). Tab content stays mounted-on-demand to keep the 1 Hz
 * updates cheap when a tab isn't visible.
 */
export function Panel({ tabs }: { tabs: PanelTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id);
  const [open, setOpen] = useState(false);
  const current = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <section
      className="pointer-events-auto fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-[#05080e]/92 backdrop-blur-md sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-8 sm:top-44 sm:w-[340px] sm:rounded-sm sm:border"
      aria-label="Sky and near-miss panel"
    >
      <div className="flex items-stretch border-b border-[var(--line)]">
        <div role="tablist" className="flex flex-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={t.id === current?.id}
              onClick={() => {
                setActive(t.id);
                setOpen(true);
              }}
              className={`flex-1 px-3 py-3 font-mono text-[10px] tracking-[0.2em] transition-colors ${
                t.id === current?.id ? "text-[var(--accent)]" : "text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-label={open ? "Collapse panel" : "Expand panel"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="px-4 font-mono text-xs text-[var(--muted)] sm:hidden"
        >
          {open ? "▾" : "▴"}
        </button>
      </div>
      <div
        role="tabpanel"
        className={`overflow-y-auto overscroll-contain ${open ? "max-h-[52dvh]" : "max-h-0"} sm:max-h-[calc(100dvh-16rem)]`}
      >
        {current?.content}
      </div>
    </section>
  );
}
