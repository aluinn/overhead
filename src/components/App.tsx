"use client";

import { GlobeClient } from "@/components/globe/GlobeClient";
import { CounterBadge } from "@/components/hud/CounterBadge";
import { Legend } from "@/components/hud/Legend";
import { ConjunctionCard } from "@/components/hud/ConjunctionCard";
import { LocationPicker } from "@/components/hud/LocationPicker";
import { ObjectCard } from "@/components/hud/ObjectCard";
import { Panel, type PanelTab } from "@/components/hud/Panel";
import { TimeControls } from "@/components/hud/TimeControls";
import { Wordmark } from "@/components/hud/Wordmark";
import { NearMissFeed } from "@/components/feed/NearMissFeed";
import { SkyTab } from "@/components/sky/SkyTab";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { useSatellites } from "@/hooks/useSatellites";
import { useConjunctions } from "@/hooks/useConjunctions";
import { useSkyAnalysis } from "@/hooks/useObserver";
import { RuntimeProvider } from "@/store/runtime";

const TABS: PanelTab[] = [
  { id: "sky", label: "OVER MY HEAD", content: <SkyTab /> },
  { id: "near-miss", label: "NEAR MISSES", content: <NearMissFeed /> },
];

function Scene() {
  useSatellites();
  useSkyAnalysis();
  useConjunctions();
  const embed = useEmbedMode();
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[var(--bg)]">
      <GlobeClient />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-40 bg-gradient-to-t from-[var(--bg)] to-transparent opacity-80" />

      <Wordmark />
      <CounterBadge showActions={!embed} />
      {!embed && <Panel tabs={TABS} />}

      <div className={`pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-3 p-4 sm:p-6 ${embed ? "" : "pb-16"}`}>
        <ObjectCard />
        {!embed && <ConjunctionCard />}
        {!embed && <TimeControls />}
      </div>
      {!embed && (
        <div className="absolute bottom-6 left-8 z-10 hidden sm:block">
          <Legend />
        </div>
      )}
      {!embed && <LocationPicker />}
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
