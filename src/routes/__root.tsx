import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";

function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const activeKey =
    path.startsWith("/activities") ? "activities"
    : path.startsWith("/progress") ? "progress"
    : "today";

  useLiveUpdates();

  return (
    <Shell activeKey={activeKey}>
      <Outlet />
    </Shell>
  );
}

export const Route = createRootRoute({ component: RootLayout });
