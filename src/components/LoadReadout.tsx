import clsx from "clsx";
import type { WeeklyLoad } from "#shared/aggregate";

/**
 * The "am I doing too much or too little" glance: this week's distance or
 * time against the trailing average, as a single mono readout. Stays inside
 * the existing token vocabulary rather than inventing a warning color —
 * Signal Teal for "this matters" (notably more), muted for notably less.
 */
export function LoadReadout({ load, metric }: { load: WeeklyLoad; metric: "distance" | "time" }) {
  const pct = metric === "distance" ? load.distancePct : load.timePct;
  const label = metric === "distance" ? "distance" : "time";

  if (pct === null) {
    return <p className="font-mono text-xs text-faint">Not enough history yet</p>;
  }

  const delta = Math.round(pct) - 100;
  const arrow = delta >= 0 ? "▲" : "▼";

  return (
    <p
      className={clsx(
        "font-mono text-xs font-bold",
        pct >= 115 ? "text-accent" : pct <= 85 ? "text-muted" : "text-text",
      )}
    >
      {arrow} {Math.abs(delta)}%{" "}
      <span className="font-sans font-semibold text-muted">
        {delta >= 0 ? "more" : "less"} {label} than your 6-wk avg
      </span>
    </p>
  );
}
