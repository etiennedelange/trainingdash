import { lazy, Suspense, useRef, useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { activeDays, computeStreak, groupByDay } from "#shared/aggregate";
import { ActivityRow, SPORT_CATEGORY, SPORT_CATEGORY_LABEL, type SportCategory } from "@/components/ActivityRow";
import { StatTile } from "@/components/StatTile";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { formatDayHeading, todayLocalDate } from "@/lib/format";
import type { ActivitySummary } from "#shared/types";

const ActivityCalendar = lazy(() =>
  import("@/charts/ActivityCalendar").then((m) => ({ default: m.ActivityCalendar })),
);

const TABS = ["Timeline", "Calendar"] as const;
const SPORT_FILTERS: SportCategory[] = ["run", "ride", "walk", "strength"];

export function Activities({ today }: { today: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");
  const [sportFilter, setSportFilter] = useState<SportCategory | null>(null);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isPending, isError, error, refetch } = useQuery(activitiesQuery);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="activities" />;

  const days = activeDays(data);
  const streak = computeStreak(data, today);

  // Stat tiles stay lifetime totals regardless of the filters below — they
  // answer "how am I doing overall," a different question than "show me X."
  const queryNorm = query.trim().toLowerCase();
  const visible: ActivitySummary[] = data.filter((a) => {
    if (sportFilter && SPORT_CATEGORY[a.sport_type] !== sportFilter) return false;
    if (queryNorm && !a.name.toLowerCase().includes(queryNorm)) return false;
    if (dateFrom && a.local_date < dateFrom) return false;
    if (dateTo && a.local_date > dateTo) return false;
    return true;
  });
  const timelineGroups = groupByDay(visible);
  const hasFilters = queryNorm !== "" || sportFilter !== null || dateFrom !== "" || dateTo !== "";

  function clearFilters() {
    setQuery("");
    setSportFilter(null);
    setDateFrom("");
    setDateTo("");
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

      <div
        role="tablist"
        aria-label="Activities view"
        className="mt-8 flex gap-2"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft" && e.key !== "Home" && e.key !== "End") return;
          e.preventDefault();
          const i = TABS.indexOf(tab);
          const next =
            e.key === "ArrowRight" ? (i + 1) % TABS.length
            : e.key === "ArrowLeft" ? (i - 1 + TABS.length) % TABS.length
            : e.key === "Home" ? 0
            : TABS.length - 1;
          setTab(TABS[next]!);
          tabRefs.current[next]?.focus();
        }}
      >
        {TABS.map((t, i) => (
          <button
            key={t}
            ref={(el) => {
              tabRefs.current[i] = el;
            }}
            role="tab"
            aria-selected={tab === t}
            tabIndex={tab === t ? 0 : -1}
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
              <div className="mb-4 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <input
                    type="search"
                    aria-label="Search activities"
                    placeholder="Search by name…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="min-w-0 flex-1 rounded-[var(--radius-control)] border border-line bg-card px-3 py-1.5 text-sm text-text outline-none placeholder:text-faint focus:border-accent"
                  />
                  {hasFilters ? (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="flex-none rounded-[var(--radius-control)] px-2 py-1.5 text-xs font-semibold text-muted hover:text-text"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-2">
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

                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      data-testid="from-date"
                      aria-label="From date"
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="rounded-[var(--radius-control)] border border-line bg-card px-3 py-1.5 font-mono text-xs text-muted outline-none focus:border-accent"
                    />
                    <span className="font-mono text-xs text-faint">–</span>
                    <input
                      type="date"
                      data-testid="to-date"
                      aria-label="To date"
                      onChange={(e) => setDateTo(e.target.value)}
                      className="rounded-[var(--radius-control)] border border-line bg-card px-3 py-1.5 font-mono text-xs text-muted outline-none focus:border-accent"
                    />
                  </div>
                </div>
              </div>

              {timelineGroups.length === 0 ? (
                <p className="text-sm text-muted">
                  No activities match your filters.{" "}
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="font-bold text-text underline underline-offset-2"
                  >
                    Clear filters
                  </button>
                </p>
              ) : (
                <div className="flex flex-col gap-6">
                  {timelineGroups.map((group) => (
                    <div key={group.date} id={`day-${group.date}`}>
                      <h2 className="sticky top-0 z-10 border-b border-line bg-ground py-3 text-sm font-bold text-muted">
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
            <Suspense fallback={<LoadingState />}>
              <ActivityCalendar days={days} year={Number(today.slice(0, 4))} />
            </Suspense>
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
