export function Wordmark() {
  return (
    <header className="pointer-events-none absolute left-5 top-5 z-10 select-none sm:left-8 sm:top-7">
      <div className="flex items-center gap-2.5">
        <span className="relative grid size-2.5 place-items-center">
          <span className="absolute size-2.5 animate-ping rounded-full bg-[var(--accent)] opacity-40" />
          <span className="size-1.5 rounded-full bg-[var(--accent)]" />
        </span>
        <h1 className="font-mono text-[13px] font-medium tracking-[0.32em] text-[var(--fg)]">OVERHEAD</h1>
      </div>
      <p className="mt-1.5 font-mono text-[10px] tracking-[0.18em] text-[var(--muted)]">
        EVERYTHING IN ORBIT, RIGHT NOW
      </p>
    </header>
  );
}
