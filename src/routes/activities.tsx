import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activities",
  component: () => <div className="p-10 text-muted">Activities — coming in Task 7.</div>,
});
