import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { activeDays, computeStreak, groupByDay } from "#shared/aggregate";
import { ActivityRow, SPORT_CATEGORY, SPORT_CATEGORY_LABEL, type SportCategory } from "@/components/ActivityRow";
import { ActivityCalendar } from "@/charts/ActivityCalendar";
import { StatTile } from "@/components/StatTile";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { formatDayHeading, todayLocalDate } from "@/lib/format";
import type { ActivitySummary } from "#shared/types";

const TABS = ["Timeline", "Calendar"] as const;
const SPORT_FILTERS: SportCategory[] = ["run", "ride", "walk", "strength"];

export function Activities({ today }: { today: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");
  const [sportFilter, setSportFilter] = useState<SportCategory | null>(null);
  const { data, isPending, isError, error, refetch } = useQuery(activitiesQuery);

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="activities" />;

  const days = activeDays(data);
  const streak = computeStreak(data, today);

  // Stat tiles stay lifetime totals regardless of the filter below — they
  // answer "how am I doing overall," a different question than "show me X."
  const visible: ActivitySummary[] = sportFilter
    ? data.filter((a) => SPORT_CATEGORY[a.sport_type] === sportFilter)
    : data;
  const timelineGroups = groupByDay(visible);

  function jumpToDate(dateStr: string) {
    if (!dateStr || timelineGroups.length === 0) return;
    const target =
      timelineGroups.find((g) => g.date <= dateStr) ?? timelineGroups[timelineGroups.length - 1];
    document.getElementById(`day-${target!.date}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Activities</h1>
      <p className="mt-1 text-sm text-muted">History, calendar and streaks</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div data-testid="active-days">
          <StatTile label="active days" value={String(days.length)} />
        </div>
        <StatTile label="longest streak" value={String(streak.longest)} />
        <StatTile label="activities" value={String(data.length)} />
      </div>

      <div role="tablist" className="mt-8 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-[var(--radius-control)] px-4 py-2 text-xs font-bold transition-colors",
              tab === t ? "bg-raised text-text" : "text-muted hover:bg-raised",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Timeline" ? (
          data.length === 0 ? (
            <p className="text-sm text-muted">
              No activities yet — the import runs in the background after you connect.
            </p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by sport">
                  <button
                    type="button"
                    aria-pressed={sportFilter === null}
                    onClick={() => setSportFilter(null)}
                    className={clsx(
                      "rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-semibold transition-colors",
                      sportFilter === null ? "bg-raised text-text" : "text-muted hover:bg-raised",
                    )}
                  >
                    All
                  </button>
                  {SPORT_FILTERS.map((f) => (
                    <button
                      key={f}
                      type="button"
                      aria-pressed={sportFilter === f}
                      onClick={() => setSportFilter(f)}
                      className={clsx(
                        "rounded-[var(--radius-control)] px-3 py-1.5 text-xs font-semibold transition-colors",
                        sportFilter === f ? "bg-raised text-text" : "text-muted hover:bg-raised",
                      )}
                    >
                      {SPORT_CATEGORY_LABEL[f]}
                    </button>
                  ))}
                </div>

                <input
                  type="date"
                  aria-label="Jump to date"
                  onChange={(e) => jumpToDate(e.target.value)}
                  className="ml-auto rounded-[var(--radius-control)] border border-line bg-card px-3 py-1.5 font-mono text-xs text-muted outline-none focus:border-accent"
                />
              </div>

              {timelineGroups.length === 0 ? (
                <p className="text-sm text-muted">
                  No {SPORT_CATEGORY_LABEL[sportFilter!].toLowerCase()} activities.{" "}
                  <button
                    type="button"
                    onClick={() => setSportFilter(null)}
                    className="font-bold text-text underline underline-offset-2"
                  >
                    Show all
                  </button>
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {timelineGroups.map((group) => (
                    <div key={group.date} id={`day-${group.date}`}>
                      <h2 className="sticky top-0 z-10 -mx-10 border-b border-line bg-ground px-10 py-3 text-sm font-bold text-muted">
                        {formatDayHeading(group.date, today)}
                      </h2>
                      <div className="mt-2 flex flex-col gap-2">
                        {group.rows.map((a) => (
                          <ActivityRow key={a.id} activity={a} />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        ) : (
          <div data-testid="calendar">
            <ActivityCalendar days={days} year={Number(today.slice(0, 4))} />
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activities",
  component: () => <Activities today={todayLocalDate()} />,
});
