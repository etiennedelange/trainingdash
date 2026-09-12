import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery, meQuery } from "@/lib/queries";
import { computeStreak, totalsBetween } from "#shared/aggregate";
import { StatTile } from "@/components/StatTile";
import { StreakReadout } from "@/components/StreakReadout";
import { ActivityRow } from "@/components/ActivityRow";
import { EnableNotifications } from "@/components/EnableNotifications";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { formatDistance, formatDuration, todayLocalDate } from "@/lib/format";

export function Today({ today }: { today: string }) {
  const { data, isPending, isError, error, refetch } = useQuery(activitiesQuery);
  const { data: me } = useQuery(meQuery);

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="activities" />;

  const streak = computeStreak(data, today);
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const week = totalsBetween(data, weekStart.toISOString().slice(0, 10), today);

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Today</h1>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No activities yet — the import runs in the background after you connect.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <StreakReadout current={streak.current} longest={streak.longest} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile label="this week" value={formatDistance(week.distance)} unit="km" />
            <StatTile label="time this week" value={formatDuration(week.movingTime)} />
          </div>

          <h2 className="mt-10 mb-3 text-sm font-bold text-muted">Recent activities</h2>
          <div className="flex flex-col gap-2">
            {data.slice(0, 10).map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>

          {me?.vapidPublicKey ? (
            <div className="mt-10">
              <EnableNotifications vapidPublicKey={me.vapidPublicKey} />
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Today today={todayLocalDate()} />,
});
