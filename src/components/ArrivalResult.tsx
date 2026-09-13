import { useQuery } from "@tanstack/react-query";
import { activitiesQuery } from "@/lib/queries";
import { computeStreak, recordsSetBy, weekComparison } from "#shared/aggregate";
import { useHeroArrival } from "@/hooks/useLiveUpdates";
import { useWeeklyGoal } from "@/hooks/useWeeklyGoal";
import { ArrivalHero } from "./ArrivalHero";
import { todayLocalDate } from "@/lib/format";

/**
 * App-wide "immediate result screen": the moment an activity lands on the
 * socket, this renders the ArrivalHero at the top of whatever page the
 * athlete is on — Today, Progress, Coach, an activity page — and keeps it
 * there until dismissed. The arriving activity is merged into the cached
 * history so its "what it means" frame (this week, goal progress, streak,
 * fresh personal records) is correct from the very first paint, before the
 * refetch lands.
 */
export function ArrivalResult({ today = todayLocalDate() }: { today?: string }) {
  const { activity: hero, dismiss } = useHeroArrival();
  const { data } = useQuery(activitiesQuery);
  const [goalKm] = useWeeklyGoal();

  if (!hero) return null;

  const rows = data ? [hero, ...data.filter((a) => a.id !== hero.id)] : [hero];
  const comparison = weekComparison(rows, today);
  const streak = computeStreak(rows, today);
  // Records are only trustworthy once the full history is on the client —
  // before then the arriving activity would look like a record against nothing.
  const newRecords = data ? recordsSetBy(rows, hero) : undefined;

  return (
    <div className="p-10 pb-0">
      <ArrivalHero
        activity={hero}
        context={{ ...comparison, streak: streak.current, goalKm, newRecords }}
        onDismiss={dismiss}
      />
    </div>
  );
}