import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { weeklyBuckets, sportMix } from "#shared/aggregate";
import { WeeklyDistance } from "@/charts/WeeklyDistance";
import { MixBar } from "@/components/MixBar";
import { todayLocalDate } from "@/lib/format";

export function Progress({ today }: { today: string }) {
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;
  if (data.length === 0) {
    return <p className="p-10 text-sm text-muted">Nothing to compare yet.</p>;
  }

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Progress</h1>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-muted">Distance · last 8 weeks</h2>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-4">
          <WeeklyDistance buckets={weeklyBuckets(data, 8, today)} />
        </div>
      </section>

      <section className="mt-8 max-w-md">
        <h2 className="mb-3 text-sm font-bold text-muted">Workout mix</h2>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-5">
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
