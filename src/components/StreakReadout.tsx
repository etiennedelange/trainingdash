export function StreakReadout({ current, longest }: { current: number; longest: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[var(--shadow-surface)] sm:p-8">
      <div className="flex items-baseline gap-4">
        <span
          className="font-mono text-[64px] leading-none font-bold tracking-tight text-accent tabular-nums sm:text-[88px]"
          style={{ textShadow: "0 0 28px color-mix(in srgb, var(--color-accent) 45%, transparent)" }}
        >
          {current}
        </span>
        <span className="text-[11px] font-semibold tracking-wide text-muted uppercase">
          day streak
        </span>
      </div>
      {longest > 0 ? (
        <div className="mt-4 border-t border-line pt-3 text-xs text-faint">
          {longest > current ? (
            <>
              Best: <span className="font-mono text-text">{longest}</span> days
            </>
          ) : (
            "This is your best streak yet"
          )}
        </div>
      ) : null}
    </div>
  );
}
