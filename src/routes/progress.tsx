import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progress",
  component: () => <div className="p-10 text-muted">Progress — coming in Task 8.</div>,
});
