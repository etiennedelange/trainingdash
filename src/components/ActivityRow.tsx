import { Link } from "@tanstack/react-router";
import type { ActivitySummary } from "#shared/types";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";

const SPORT_COLOR: Record<string, string> = {
  Run: "bg-run",
  TrailRun: "bg-run",
  Ride: "bg-ride",
  VirtualRide: "bg-ride",
  Walk: "bg-walk",
  Hike: "bg-walk",
  WeightTraining: "bg-strength",
  Workout: "bg-strength",
};

export function ActivityRow({ activity }: { activity: ActivitySummary }) {
  const paceSecPerKm = activity.distance > 0
    ? activity.moving_time / (activity.distance / 1000)
    : Number.NaN;

  return (
    <Link
      to="/activity/$id"
      params={{ id: String(activity.id) }}
      className="flex items-center gap-3 rounded-[var(--radius-row)] border border-line bg-card px-4 py-3 shadow-[var(--shadow-surface)] transition-colors hover:bg-raised"
    >
      <span
        className={`size-2 flex-none rounded-full ${SPORT_COLOR[activity.sport_type] ?? "bg-muted"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{activity.name}</span>
      <span className="font-mono text-xs text-muted">
        {formatDistance(activity.distance)} km · {formatDuration(activity.moving_time)} ·{" "}
        {formatPace(paceSecPerKm)}/km
      </span>
    </Link>
  );
}
