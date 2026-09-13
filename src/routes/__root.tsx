import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { AccountStatus } from "@/components/AccountStatus";
import { ArrivalResult } from "@/components/ArrivalResult";
import { CommandPalette } from "@/components/CommandPalette";
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
        <ArrivalResult />
        <Outlet />
        <UpdatePrompt />
        <CommandPalette />
      </Shell>
    </LiveArrivalsProvider>
  );
}

export const Route = createRootRoute({ component: RootLayout });
