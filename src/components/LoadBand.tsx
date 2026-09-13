import type { Acwr, LoadBandId } from "#shared/aggregate";

const BAND_TEXT: Record<LoadBandId, string> = {
  detraining: "Detraining — build back up",
  steady: "Steady load",
  spiking: "Spiking — ease off",
};

// The ratio is displayed across a fixed 0–2 scale; the three zones match the
// chronic-mean multiples used by acwr (0.8 detrain, 1.5 spike).
const ZONE = [
  { width: "40%", color: "bg-muted/25" },   // 0.00–0.80
  { width: "35%", color: "bg-accent/25" },  // 0.80–1.50
  { width: "25%", color: "bg-danger/25" },  // 1.50–2.00
] as const;

/**
 * The "am I doing too much or too little" instrument: the acute:chronic
 * workload ratio rendered as a marker on a detraining / steady / spiking
 * band. One signal color for on-track, muted for undertraining, Danger Red
 * for a genuine spike — semantic colors only, per the design system.
 */
export function LoadBand({ acwr }: { acwr: Acwr }) {
  if (acwr.ratio === null || acwr.band === null) {
    return (
      <div className="rounded-[var(--radius-row)] border border-line bg-card px-4 py-3 shadow-[var(--shadow-surface)]">
        <p className="font-mono text-xs text-faint">
          Not enough history yet — load needs 28 days.
        </p>
      </div>
    );
  }

  const pct = (Math.min(acwr.ratio, 2) / 2) * 100;
  const color =
    acwr.band === "spiking" ? "bg-danger" : acwr.band === "steady" ? "bg-accent" : "bg-muted";

  return (
    <div className="rounded-[var(--radius-row)] border border-line bg-card px-4 py-3 shadow-[var(--shadow-surface)]">
      <div className="flex items-center gap-3">
        <span className="w-11 flex-none font-mono text-sm font-bold text-text">
          {acwr.ratio.toFixed(1)}
        </span>
        <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-raised">
          <div className="absolute inset-0 flex" aria-hidden="true">
            {ZONE.map((z) => (
              <span key={z.width} className={`h-full ${z.color}`} style={{ width: z.width }} />
            ))}
          </div>
          <span
            className={`absolute top-1/2 size-2.5 rounded-full ${color} ring-2 ring-card`}
            style={{ left: `${pct}%`, top: "50%", transform: "translate(-50%, -50%)" }}
          />
        </div>
        <span className="flex-none text-xs font-semibold text-muted">{BAND_TEXT[acwr.band]}</span>
      </div>
      <p className="mt-1.5 text-[11px] font-semibold tracking-wide text-muted uppercase">
        Acute:chronic load
      </p>
    </div>
  );
}