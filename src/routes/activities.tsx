import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { activeDays, computeStreak } from "#shared/aggregate";
import { ActivityRow } from "@/components/ActivityRow";
import { ActivityCalendar } from "@/charts/ActivityCalendar";
import { StatTile } from "@/components/StatTile";
import { todayLocalDate } from "@/lib/format";

const TABS = ["Timeline", "Calendar"] as const;

export function Activities({ today }: { today: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;

  const days = activeDays(data);
  const streak = computeStreak(data, today);

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
          <div className="flex flex-col gap-2">
            {data.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
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
