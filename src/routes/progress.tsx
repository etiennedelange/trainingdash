import { lazy, Suspense, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import {
  acwr,
  bestWeekDistance,
  personalRecords,
  weekComparison,
  weeklyBuckets,
  weeklyLoad,
  sportMix,
} from "#shared/aggregate";

const WeeklyDistance = lazy(() =>
  import("@/charts/WeeklyDistance").then((m) => ({ default: m.WeeklyDistance })),
);
import { MixBar } from "@/components/MixBar";
import { LoadBand } from "@/components/LoadBand";
import { useWeeklyGoal } from "@/hooks/useWeeklyGoal";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { formatDistance, formatPace, todayLocalDate } from "@/lib/format";

function RecordTile({ value, label, note }: { value: string; label: string; note: string }) {
  return (
    <div className="rounded-[var(--radius-tile)] border border-line bg-card p-4 shadow-[var(--shadow-surface)]">
      <div className="font-mono text-2xl font-bold text-text">{value}</div>
      <div className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">{label}</div>
      <div className="mt-1 truncate text-xs text-faint" title={note}>
        {note}
      </div>
    </div>
  );
}

function GoalSetter({
  goal,
  onSet,
  onClear,
}: {
  goal: number | null;
  onSet: (km: number) => void;
  onClear: () => void;
}) {
  const [draft, setDraft] = useState(goal ? String(goal) : "");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const n = Number(draft);
        if (Number.isFinite(n) && n > 0) onSet(n);
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor="weekly-goal" className="text-xs font-semibold text-muted">
        Weekly goal
      </label>
      <input
        id="weekly-goal"
        type="number"
        inputMode="decimal"
        min="1"
        step="0.5"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={goal ? String(goal) : "km"}
        aria-label="Weekly distance goal in kilometres"
        className="w-20 rounded-[var(--radius-control)] border border-line bg-card px-2 py-1 font-mono text-xs text-text outline-none focus:border-accent"
      />
      <button
        type="submit"
        className="rounded-[var(--radius-control)] bg-accent px-3 py-1 text-xs font-bold text-on-accent"
      >
        Set
      </button>
      {goal ? (
        <button
          type="button"
          onClick={() => {
            onClear();
            setDraft("");
          }}
          className="rounded-[var(--radius-control)] px-2 py-1 text-xs font-semibold text-muted hover:text-text"
        >
          Clear
        </button>
      ) : null}
    </form>
  );
}

export function Progress({ today }: { today: string }) {
  const { data, isPending, isError, error, refetch } = useQuery(activitiesQuery);
  const [goal, setGoal] = useWeeklyGoal();

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="activities" />;
  if (data.length === 0) {
    return <p className="p-10 text-sm text-muted">Nothing to compare yet.</p>;
  }

  const load = weeklyLoad(data, today);
  const loadRatio = acwr(data, today);
  const week = weekComparison(data, today).week;
  const pr = personalRecords(data);
  const bestWeek = bestWeekDistance(data);

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Progress</h1>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-muted">Distance · last 8 weeks</h2>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-4 shadow-[var(--shadow-surface)]">
          <Suspense fallback={<LoadingState />}>
            <WeeklyDistance
              buckets={weeklyBuckets(data, 8, today)}
              averageDistance={load.average?.distance}
              goalKm={goal}
            />
          </Suspense>

          {goal ? (
            <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
              <span className="text-xs font-semibold text-muted">This week</span>
              <span className="font-mono text-sm font-bold">
                {formatDistance(week.distance)} km
                <span className="text-faint"> / {goal} km</span>
              </span>
            </div>
          ) : null}

          <div className="mt-3">
            <GoalSetter goal={goal} onSet={setGoal} onClear={() => setGoal(null)} />
          </div>
        </div>

        <div className="mt-3">
          <LoadBand acwr={loadRatio} />
        </div>
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-muted">Personal records</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {pr.longestRun ? (
            <RecordTile
              value={`${formatDistance(pr.longestRun.value)} km`}
              label="longest run"
              note={`${pr.longestRun.name} · ${pr.longestRun.date}`}
            />
          ) : null}
          {pr.fastestRun ? (
            <RecordTile
              value={`${formatPace(pr.fastestRun.value)} /km`}
              label="fastest run"
              note={`${pr.fastestRun.name} · ${pr.fastestRun.date}`}
            />
          ) : null}
          {pr.mostClimb ? (
            <RecordTile
              value={`${Math.round(pr.mostClimb.value)} m`}
              label="most climbing"
              note={`${pr.mostClimb.name} · ${pr.mostClimb.date}`}
            />
          ) : null}
          {bestWeek ? (
            <RecordTile
              value={`${formatDistance(bestWeek.distance)} km`}
              label="best week"
              note={`Week of ${bestWeek.weekStart}`}
            />
          ) : null}
        </div>
      </section>

      <section className="mt-8 max-w-md">
        <h2 className="mb-3 text-sm font-bold text-muted">Workout mix</h2>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-5 shadow-[var(--shadow-surface)]">
          <MixBar slices={sportMix(data)} />
        </div>
      </section>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progress",
  component: () => <Progress today={todayLocalDate()} />,
});