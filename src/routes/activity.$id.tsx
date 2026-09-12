import { createRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activityQuery } from "@/lib/queries";
import { RouteMap } from "@/map/RouteMap";
import { parsePolyline } from "@/map/polyline";
import { StatTile } from "@/components/StatTile";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";

function ActivityDetail() {
  const { id } = useParams({ from: "/activity/$id" });
  const { data, isPending, isError, error, refetch } = useQuery(activityQuery(Number(id)));

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="this activity" />;

  const pace = data.distance > 0 ? data.moving_time / (data.distance / 1000) : Number.NaN;
  const hasRoute = data.polyline ? parsePolyline(data.polyline).length >= 2 : false;

  return (
    <div className="flex min-h-full flex-col p-10">
      <Link to="/" className="text-xs font-bold text-muted hover:text-text">
        ← Back to Today
      </Link>

      <h1 className="mt-4 line-clamp-2 font-display text-[27px] font-bold" title={data.name}>
        {data.name}
      </h1>
      <p className="mt-1 text-sm text-muted">
        {data.local_date} · {data.sport_type}
      </p>
      <span role="status" aria-live="polite" className="sr-only">
        Activity loaded: {data.name}
      </span>

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

      <figure className="mt-8 flex min-h-[320px] flex-1 flex-col">
        <RouteMap
          polyline={data.polyline}
          label={`Route map for ${data.name}`}
          emptyMessage="No route recorded for this activity."
        />
        {hasRoute ? (
          <figcaption className="sr-only">
            Route map for {data.name}: {formatDistance(data.distance)} over{" "}
            {formatDuration(data.moving_time)}.
          </figcaption>
        ) : null}
      </figure>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity/$id",
  component: ActivityDetail,
});
