import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery, meQuery } from "@/lib/queries";
import { computeStreak, weeklyLoad, weekComparison } from "#shared/aggregate";
import { StatTile } from "@/components/StatTile";
import { StreakReadout } from "@/components/StreakReadout";
import { ActivityRow } from "@/components/ActivityRow";
import { LoadReadout } from "@/components/LoadReadout";
import { EnableNotifications } from "@/components/EnableNotifications";
import { DataError } from "@/components/DataError";
import { LoadingState } from "@/components/LoadingState";
import { useHeroArrival } from "@/hooks/useLiveUpdates";
import { formatDistance, formatDuration, todayLocalDate } from "@/lib/format";

export function Today({ today }: { today: string }) {
  const { data, isPending, isError, error, refetch } = useQuery(activitiesQuery);
  const { data: me } = useQuery(meQuery);
  const { activity: heroActivity } = useHeroArrival();

  if (isPending) return <LoadingState />;
  if (isError) return <DataError error={error} onRetry={() => void refetch()} subject="activities" />;

  // The socket payload is the freshest copy of the just-arrived row, and the
  // cache refetch that follows it is async — so Today's own stats merge the
  // arriving activity in now, rather than waiting on it. (The hero itself
  // renders app-wide via ArrivalResult in the root layout.)
  const rows = heroActivity
    ? [heroActivity, ...data.filter((a) => a.id !== heroActivity.id)]
    : data;

  const comparison = weekComparison(rows, today);
  const streak = computeStreak(rows, today);
  const load = weeklyLoad(rows, today);

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Today</h1>

      {rows.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No activities yet — the import runs in the background after you connect.
        </p>
      ) : (
        <>
          <div className="mt-6">
            <StreakReadout current={streak.current} longest={streak.longest} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3">
            <StatTile label="this week" value={formatDistance(comparison.week.distance)} unit="km" />
            <StatTile label="time this week" value={formatDuration(comparison.week.movingTime)} />
          </div>

          <div className="mt-3">
            <LoadReadout load={load} metric="distance" />
          </div>

          <h2 className="mt-10 mb-3 text-sm font-bold text-muted">Recent activities</h2>
          <div className="flex flex-col gap-2">
            {rows.slice(0, 10).map((a) => (
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
