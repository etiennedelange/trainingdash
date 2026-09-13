import { Link } from "@tanstack/react-router";
import type { ActivitySummary } from "#shared/types";
import type { WeekComparison } from "#shared/aggregate";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";
import { StatTile } from "./StatTile";
import { SPORT_CATEGORY, SPORT_CATEGORY_LABEL } from "./ActivityRow";

/** What a just-arrived activity means, computed from the athlete's history:
 *  this week's frame plus the running streak it just extended. `goalKm` is the
 *  weekly distance target, when one is set — the concrete "how much is left"
 *  framing that replaces a purely comparative one. `newRecords` lists the
 *  personal records this activity just set, if any. */
export interface ArrivalHeroContext extends WeekComparison {
  streak: number;
  goalKm?: number | null;
  newRecords?: string[];
}

/**
 * The Today page's "immediate result screen" for a just-arrived activity —
 * the persistent counterpart to ActivityRow's brief "new" glow. Spends the
 * warm gradient DESIGN.md reserves for exactly this moment, and stays on
 * screen until the athlete dismisses it or navigates away. The context block
 * turns "an activity landed" into "here's what it means."
 */
export function ArrivalHero({
  activity,
  context,
  onDismiss,
}: {
  activity: ActivitySummary;
  context?: ArrivalHeroContext;
  onDismiss: () => void;
}) {
  const pace = activity.distance > 0 ? activity.moving_time / (activity.distance / 1000) : Number.NaN;
  const category = SPORT_CATEGORY[activity.sport_type];
  const delta =
    context && context.distanceDeltaPct !== null ? Math.round(context.distanceDeltaPct) - 100 : null;
  const goalPct = context?.goalKm
    ? Math.min((context.week.distance / (context.goalKm * 1000)) * 100, 100)
    : null;

  return (
    <div className="animate-arrival relative rounded-[var(--radius-card)] border border-line bg-card p-6 shadow-[var(--shadow-surface)]">
      <button
        onClick={onDismiss}
        aria-label="Dismiss"
        className="absolute top-4 right-4 text-muted hover:text-text"
      >
        ×
      </button>

      <span className="rounded-[var(--radius-control)] bg-gradient-to-r from-warm-from to-warm-to px-1.5 py-0.5 font-mono text-[11px] font-bold text-on-accent uppercase">
        Just arrived
      </span>

      <Link to="/activity/$id" params={{ id: String(activity.id) }} className="mt-3 block">
        <h2 className="line-clamp-2 font-display text-xl font-bold hover:underline">{activity.name}</h2>
        <p className="mt-1 text-sm text-muted">
          {category ? SPORT_CATEGORY_LABEL[category] : activity.sport_type} ·{" "}
          {activity.local_date}
        </p>
      </Link>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="kilometers" value={formatDistance(activity.distance)} accent />
        <StatTile label="duration" value={formatDuration(activity.moving_time)} />
        <StatTile label="min / km" value={formatPace(pace)} />
        <StatTile
          label="avg heart rate"
          value={activity.average_heartrate ? String(Math.round(activity.average_heartrate)) : "—"}
          unit={activity.average_heartrate ? "bpm" : undefined}
        />
      </div>

      {context ? (
        <div className="mt-4 border-t border-line pt-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {context.isBestWeek ? (
              <span className="inline-flex rounded-[var(--radius-control)] bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent uppercase">
                Best week yet
              </span>
            ) : null}
            {context.newRecords?.map((label) => (
              <span
                key={label}
                className="inline-flex rounded-[var(--radius-control)] bg-accent/10 px-1.5 py-0.5 font-mono text-[11px] font-bold text-accent uppercase"
              >
                New record · {label}
              </span>
            ))}
          </div>

          {context.goalKm ? (
            <div className="mb-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-xs font-semibold text-muted">Weekly goal</span>
                <span className="font-mono text-sm font-bold">
                  {formatDistance(context.week.distance)} km
                  <span className="text-faint"> / {context.goalKm} km</span>
                </span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-raised">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${goalPct ?? 0}%` }}
                />
              </div>
              <p className="mt-1 text-right font-mono text-[11px] font-bold text-accent">
                {Math.round(goalPct ?? 0)}%
              </p>
            </div>
          ) : null}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-semibold text-muted">This week</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold">
                {formatDistance(context.week.distance)} km
                <span className="ml-1 font-sans text-xs font-semibold text-muted">
                  · {context.week.count} activities
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Vs last week</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold">
                {delta === null ? (
                  <span className="font-sans text-xs font-semibold text-faint">No prior week</span>
                ) : (
                  <span className={delta >= 0 ? "text-accent" : "text-muted"}>
                    {delta >= 0 ? "▲" : "▼"} {Math.abs(delta)}%
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-muted">Streak</dt>
              <dd className="mt-0.5 font-mono text-sm font-bold">{context.streak} days</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}
