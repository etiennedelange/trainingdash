import { createRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activityQuery } from "@/lib/queries";
import { RouteMap } from "@/map/RouteMap";
import { StatTile } from "@/components/StatTile";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";

function ActivityDetail() {
  const { id } = useParams({ from: "/activity/$id" });
  const { data, isPending, isError } = useQuery(activityQuery(Number(id)));

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load that activity.</p>;

  const pace = data.distance > 0 ? data.moving_time / (data.distance / 1000) : Number.NaN;

  return (
    <div className="p-10">
      <Link to="/" className="text-xs font-bold text-muted hover:text-text">
        ← Back to Today
      </Link>

      <h1 className="mt-4 font-display text-[27px] font-bold">{data.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {data.local_date} · {data.sport_type}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="kilometers" value={formatDistance(data.distance)} accent />
        <StatTile label="duration" value={formatDuration(data.moving_time)} />
        <StatTile label="min / km" value={formatPace(pace)} />
        <StatTile
          label="avg heart rate"
          value={data.average_heartrate ? String(Math.round(data.average_heartrate)) : "—"}
          unit={data.average_heartrate ? "bpm" : undefined}
        />
      </div>

      {data.polyline ? (
        <div className="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-line shadow-[var(--shadow-surface)]">
          <RouteMap polyline={data.polyline} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">No route recorded for this activity.</p>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity/$id",
  component: ActivityDetail,
});
