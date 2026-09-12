import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { AccountStatus } from "@/components/AccountStatus";
import { LiveArrivalsProvider } from "@/hooks/useLiveUpdates";

function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const activeKey =
    path.startsWith("/activities") ? "activities"
    : path.startsWith("/progress") ? "progress"
    : path.startsWith("/coach") ? "coach"
    : "today";

  return (
    <LiveArrivalsProvider>
      <Shell activeKey={activeKey} footer={<AccountStatus />}>
        <Outlet />
        <UpdatePrompt />
      </Shell>
    </LiveArrivalsProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
