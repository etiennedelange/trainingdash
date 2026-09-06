import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import clsx from "clsx";

const NAV = [
  { key: "today", label: "Today", to: "/" },
  { key: "activities", label: "Activities", to: "/activities" },
  { key: "progress", label: "Progress", to: "/progress" },
] as const;

export function Shell({
  children,
  activeKey,
  footer,
}: {
  children: ReactNode;
  activeKey?: string;
  footer?: ReactNode;
}) {
  return (
    <div className="flex min-h-screen bg-ground">
      <nav className="flex w-[220px] flex-none flex-col gap-1 border-r border-line bg-surface p-4">
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <div className="flex size-8 items-center justify-center rounded-[10px] bg-gradient-to-br from-accent to-accent-deep">
            <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill="#062b26" />
            </svg>
          </div>
          <span className="font-display text-base font-bold">Trainingdash</span>
        </div>

        {NAV.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            aria-current={activeKey === item.key ? "page" : undefined}
            className={clsx(
              "rounded-[11px] px-3 py-2.5 text-sm font-bold transition-colors",
              activeKey === item.key ? "bg-raised text-text" : "text-muted hover:bg-raised",
            )}
          >
            {item.label}
          </Link>
        ))}

        {footer ? <div className="mt-auto pt-4">{footer}</div> : null}
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
