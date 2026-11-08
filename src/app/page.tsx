import { GlobeClient } from "@/components/globe/GlobeClient";
import { Wordmark } from "@/components/hud/Wordmark";

export default function Home() {
  return (
    <main className="relative h-dvh w-full overflow-hidden bg-[var(--bg)]">
      <GlobeClient />
      <Wordmark />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-32 bg-gradient-to-t from-[var(--bg)] to-transparent opacity-70" />
    </main>
  );
}
