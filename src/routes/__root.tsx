import { createRootRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { Shell } from "@/components/Shell";
import { UpdatePrompt } from "@/components/UpdatePrompt";
import { AccountStatus } from "@/components/AccountStatus";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useLiveUpdates } from "@/hooks/useLiveUpdates";

function RootLayout() {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const activeKey =
    path.startsWith("/activities") ? "activities"
    : path.startsWith("/progress") ? "progress"
    : path.startsWith("/coach") ? "coach"
    : "today";

  useLiveUpdates();

  return (
    <Shell
      activeKey={activeKey}
      footer={
        <div className="flex flex-col gap-1">
          <ThemeToggle />
          <AccountStatus />
        </div>
      }
    >
      <Outlet />
      <UpdatePrompt />
    </Shell>
  );
}

export const Route = createRootRoute({ component: RootLayout });
