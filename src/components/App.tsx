"use client";

import { GlobeClient } from "@/components/globe/GlobeClient";
import { CounterBadge } from "@/components/hud/CounterBadge";
import { Legend } from "@/components/hud/Legend";
import { ObjectCard } from "@/components/hud/ObjectCard";
import { TimeControls } from "@/components/hud/TimeControls";
import { Wordmark } from "@/components/hud/Wordmark";
import { useSatellites } from "@/hooks/useSatellites";
import { RuntimeProvider } from "@/store/runtime";

function Scene() {
  useSatellites();
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[var(--bg)]">
      <GlobeClient />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-t from-[var(--bg)] to-transparent opacity-80" />

      <Wordmark />
      <CounterBadge />

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 sm:p-6">
        <ObjectCard />
        <TimeControls />
      </div>
      <div className="absolute bottom-6 left-8 z-10 hidden sm:block">
        <Legend />
      </div>
    </main>
  );
}

/** Client root: owns the long-lived runtime (clock, worker, stream, store). */
export function App() {
  return (
    <RuntimeProvider>
      <Scene />
    </RuntimeProvider>
  );
}
