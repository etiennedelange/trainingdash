import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import type { ActivitySummary } from "#shared/types";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { useJustArrived, useJustUpdated } from "@/hooks/useLiveUpdates";

export type SportCategory = "run" | "ride" | "walk" | "strength";

/** The one closed lookup table every sport-aware component reads from —
 *  the color dot, the sr-only label, and the Activities-page sport filter
 *  all derive from this instead of keeping parallel copies that can drift. */
export const SPORT_CATEGORY: Record<string, SportCategory> = {
  Run: "run",
  TrailRun: "run",
  Ride: "ride",
  VirtualRide: "ride",
  Walk: "walk",
  Hike: "walk",
  WeightTraining: "strength",
  Workout: "strength",
};

export const SPORT_CATEGORY_LABEL: Record<SportCategory, string> = {
  run: "Run",
  ride: "Ride",
  walk: "Walk",
  strength: "Strength",
};

export const CATEGORY_COLOR: Record<SportCategory, string> = {
  run: "bg-run",
  ride: "bg-ride",
  walk: "bg-walk",
  strength: "bg-strength",
};

const SPORT_LABEL: Record<string, string> = {
  TrailRun: "Trail run",
  VirtualRide: "Virtual ride",
  WeightTraining: "Weight training",
};

export function ActivityRow({ activity }: { activity: ActivitySummary }) {
  const paceSecPerKm = activity.distance > 0
    ? activity.moving_time / (activity.distance / 1000)
    : Number.NaN;
  const justArrived = useJustArrived(activity.id);
  const justUpdated = useJustUpdated(activity.id);
  const category = SPORT_CATEGORY[activity.sport_type];

  return (
    <Link
      to="/activity/$id"
      params={{ id: String(activity.id) }}
      className={clsx(
        "flex items-center gap-3 rounded-[var(--radius-row)] border border-line bg-card px-4 py-3 shadow-[var(--shadow-surface)] transition-colors hover:bg-raised",
        justArrived && "animate-arrival",
        justUpdated && !justArrived && "animate-update",
      )}
    >
      {justArrived ? (
        <span className="rounded-[var(--radius-control)] bg-gradient-to-r from-warm-from to-warm-to px-1.5 py-0.5 font-mono text-[11px] font-bold text-on-accent uppercase">
          new
        </span>
      ) : null}
      <span
        className={`size-2 flex-none rounded-full ${category ? CATEGORY_COLOR[category] : "bg-muted"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">
        <span className="sr-only">
          {SPORT_LABEL[activity.sport_type] ?? activity.sport_type} activity:{" "}
        </span>
        {activity.name}
      </span>
      <span className="font-mono text-xs text-muted">
        {formatDistance(activity.distance)} km · {formatDuration(activity.moving_time)} ·{" "}
        {formatPace(paceSecPerKm)}/km
      </span>
    </Link>
  );
}
