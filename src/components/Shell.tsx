import { useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";
import { useHasLiveArrival } from "@/hooks/useLiveUpdates";
import { LiveIndicator } from "@/components/LiveIndicator";
import { ThemeToggle } from "@/components/ThemeToggle";

const NAV = [
  { key: "today", label: "Today", to: "/", showsArrivals: true },
  { key: "activities", label: "Activities", to: "/activities", showsArrivals: true },
  { key: "progress", label: "Progress", to: "/progress", showsArrivals: false },
  { key: "coach", label: "Coach", to: "/coach", showsArrivals: false },
  { key: "debug", label: "Debug", to: "/debug", showsArrivals: false },
] as const;

function Logo() {
  return (
    <Link
      to="/"
      className="-mx-2 flex items-center gap-2.5 rounded-[var(--radius-nav)] px-2 py-1.5 transition-colors hover:bg-raised/60"
    >
      <div className="flex size-8 flex-none items-center justify-center rounded-[var(--radius-control)] bg-gradient-to-br from-accent to-accent-deep">
        <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="var(--color-on-accent)" />
        </svg>
      </div>
      <span className="font-display text-base font-bold">Trainingdash</span>
    </Link>
  );
}

export function Shell({
  children,
  activeKey,
  footer,
}: {
  children: ReactNode;
  activeKey?: string;
  footer?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasLiveArrival = useHasLiveArrival();

  return (
    <div className="flex min-h-screen bg-ground">
      <div className="fixed top-3 right-3 z-50">
        <ThemeToggle variant="icon" />
      </div>

      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
        />
      ) : null}

      <nav
        aria-label="Primary"
        className={clsx(
          "fixed inset-y-0 left-0 z-40 flex w-[220px] flex-none flex-col gap-1 overflow-y-auto border-r border-line bg-surface p-4 transition-transform duration-200 sm:sticky sm:top-0 sm:h-screen sm:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="pb-4">
          <Logo />
        </div>
        <div className="mb-2 border-b border-line pb-4">
          <LiveIndicator />
        </div>

        {NAV.map((item) => {
          const isActive = activeKey === item.key;
          const showBadge = item.showsArrivals && hasLiveArrival && !isActive;
          return (
            <Link
              key={item.key}
              to={item.to}
              aria-current={isActive ? "page" : undefined}
              onClick={() => setMobileOpen(false)}
              className={clsx(
                "flex items-center gap-2 rounded-[var(--radius-nav)] px-3 py-2.5 text-sm font-bold transition-colors",
                isActive ? "bg-raised text-text" : "text-muted hover:bg-raised/60",
              )}
            >
              {item.label}
              {showBadge ? (
                <span
                  aria-label="New activity"
                  className="size-1.5 rounded-full bg-gradient-to-r from-warm-from to-warm-to"
                />
              ) : null}
            </Link>
          );
        })}

        {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
      </nav>

      <div className="flex h-dvh min-w-0 flex-1 flex-col">
        <header className="flex flex-none items-center gap-3 border-b border-line bg-surface p-3 sm:hidden">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
            className="flex size-9 items-center justify-center rounded-[var(--radius-control)] text-muted hover:bg-raised"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <span className="font-display text-sm font-bold">Trainingdash</span>
        </header>

        <main className="relative min-h-0 min-w-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
