import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity/$id",
  component: () => <div className="p-10 text-muted">Activity detail — coming in Task 9.</div>,
});
