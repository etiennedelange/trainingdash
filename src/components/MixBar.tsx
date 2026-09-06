import type { SportSlice } from "#shared/aggregate";

const COLOR: Record<string, string> = {
  Run: "var(--color-run)",
  TrailRun: "var(--color-run)",
  Ride: "var(--color-ride)",
  VirtualRide: "var(--color-ride)",
  Walk: "var(--color-walk)",
  Hike: "var(--color-walk)",
  WeightTraining: "var(--color-strength)",
  Workout: "var(--color-strength)",
};

export function MixBar({ slices }: { slices: SportSlice[] }) {
  return (
    <div className="flex flex-col gap-3">
      {slices.map((s) => (
        <div key={s.sport} className="flex items-center gap-3">
          <span className="w-24 flex-none truncate text-xs font-bold">{s.sport}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <span
              className="block h-full rounded-full"
              style={{ width: `${s.pct}%`, background: COLOR[s.sport] ?? "var(--color-muted)" }}
            />
          </span>
          <span className="w-10 flex-none text-right font-mono text-xs text-muted">{s.pct}%</span>
        </div>
      ))}
    </div>
  );
}
