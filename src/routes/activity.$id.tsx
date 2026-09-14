import { createRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Route as rootRoute } from "./__root";
import { activityQuery } from "@/lib/queries";
import { RouteMap } from "@/map/RouteMap";
import { parsePolyline } from "@/map/polyline";
import { StatTile } from "@/components/StatTile";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import type { ActivityExtra } from "#shared/types";
import { useJustArrived, useJustUpdated } from "@/hooks/useLiveUpdates";

function hasExtra(extra: ActivityExtra | null): extra is ActivityExtra {
  if (!extra) return false;
  return Object.values(extra).some((v) => v !== null);
}

function ExtraStats({ extra }: { extra: ActivityExtra }) {
  const tiles: { label: string; value: string; unit?: string }[] = [];
  if (extra.calories !== null) tiles.push({ label: "calories", value: String(Math.round(extra.calories)) });
  if (extra.average_cadence !== null) {
    tiles.push({ label: "avg cadence", value: String(Math.round(extra.average_cadence)), unit: "rpm" });
  }
  if (extra.weighted_average_watts !== null) {
    tiles.push({ label: "avg power", value: String(Math.round(extra.weighted_average_watts)), unit: "W" });
  } else if (extra.average_watts !== null) {
    tiles.push({ label: "avg power", value: String(Math.round(extra.average_watts)), unit: "W" });
  }
  if (extra.elev_high !== null && extra.elev_low !== null) {
    tiles.push({
      label: "elevation range",
      value: `${Math.round(extra.elev_low)}–${Math.round(extra.elev_high)}`,
      unit: "m",
    });
  }
  if (extra.kudos_count !== null) tiles.push({ label: "kudos", value: String(extra.kudos_count) });
  if (extra.pr_count !== null && extra.pr_count > 0) {
    tiles.push({ label: "personal records", value: String(extra.pr_count) });
  }

  if (tiles.length === 0) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => (
        <StatTile key={t.label} label={t.label} value={t.value} unit={t.unit} />
      ))}
    </div>
  );
}

function Splits({ splits }: { splits: NonNullable<ActivityExtra["splits_metric"]> }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold text-muted">Splits · per kilometer</h2>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-surface)]">
        <table className="w-full min-w-[420px] text-left text-xs">
          <thead>
            <tr className="border-b border-line text-muted">
              <th className="p-3 font-semibold">Km</th>
              <th className="p-3 font-semibold">Pace</th>
              <th className="p-3 font-semibold">Time</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {splits.map((s, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="p-3">{i + 1}</td>
                <td className="p-3">{formatPace(1000 / s.average_speed)} /km</td>
                <td className="p-3">{formatDuration(s.moving_time)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function BestEfforts({ efforts }: { efforts: NonNullable<ActivityExtra["best_efforts"]> }) {
  return (
    <section className="mt-8">
      <h2 className="mb-3 text-sm font-bold text-muted">Best efforts</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {efforts.map((e) => (
          <StatTile key={e.name} label={e.name} value={formatDuration(e.moving_time)} />
        ))}
      </div>
    </section>
  );
}

function ActivityDetail() {
  const { id } = useParams({ from: "/activity/$id" });
  const { data, isPending, isError, error, refetch } = useQuery(activityQuery(Number(id)));
  const justArrived = useJustArrived(Number(id));
  const justUpdated = useJustUpdated(Number(id));

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="this activity" />;

  const pace = data.distance > 0 ? data.moving_time / (data.distance / 1000) : Number.NaN;
  const hasRoute = data.polyline ? parsePolyline(data.polyline).length >= 2 : false;

  return (
    <div className="flex min-h-full flex-col p-10">
      <Link to="/" className="text-xs font-bold text-muted hover:text-text">
        ← Back to Today
      </Link>

      <div
        className={clsx(
          "-mx-5 -my-4 mt-4 rounded-[var(--radius-card)] px-5 py-4",
          justArrived && "animate-arrival",
          justUpdated && !justArrived && "animate-update",
        )}
      >
        {justArrived ? (
          <span className="mb-2 inline-flex rounded-[var(--radius-control)] bg-gradient-to-r from-warm-from to-warm-to px-1.5 py-0.5 font-mono text-[11px] font-bold text-on-accent uppercase">
            Just arrived
          </span>
        ) : justUpdated ? (
          <span className="mb-2 inline-flex rounded-[var(--radius-control)] bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent uppercase">
            Updated
          </span>
        ) : null}
        <h1 className="line-clamp-2 font-display text-[27px] font-bold" title={data.name}>
          {data.name}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {data.local_date} · {data.sport_type}
        </p>
      </div>
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

      {hasExtra(data.extra) ? <ExtraStats extra={data.extra} /> : null}

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

      {data.extra?.splits_metric?.length ? <Splits splits={data.extra.splits_metric} /> : null}
      {data.extra?.best_efforts?.length ? <BestEfforts efforts={data.extra.best_efforts} /> : null}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity/$id",
  component: ActivityDetail,
});
