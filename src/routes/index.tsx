import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";

function Today() {
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Today</h1>
      <p className="mt-1 text-sm text-muted">{data.length} activities</p>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Today,
});
