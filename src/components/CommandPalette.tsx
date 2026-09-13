import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { activitiesQuery } from "@/lib/queries";
import { formatDistance } from "@/lib/format";
import { CATEGORY_COLOR, SPORT_CATEGORY } from "./ActivityRow";
import type { ActivitySummary } from "#shared/types";

const NAV_ITEMS = [
  { label: "Today", to: "/" },
  { label: "Activities", to: "/activities" },
  { label: "Progress", to: "/progress" },
  { label: "Coach", to: "/coach" },
] as const;

const MAX_RESULTS = 12;

type PaletteItem =
  | { kind: "nav"; label: string; to: string }
  | { kind: "activity"; activity: ActivitySummary };

/**
 * Cmd+K command palette: jump to any page or any activity by name, straight
 * from the keyboard. A floating overlay, so it earns the design system's one
 * allowed shadow; arrow keys navigate, Enter opens, Esc dismisses.
 */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { data } = useQuery(activitiesQuery);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    // A frame lets the input mount before focusing.
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const q = query.trim().toLowerCase();
    const nav = NAV_ITEMS.filter((n) => !q || n.label.toLowerCase().includes(q));
    const activities = (data ?? [])
      .filter((a) => !q || a.name.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
    return [
      ...nav.map((n) => ({ kind: "nav" as const, ...n })),
      ...activities.map((a) => ({ kind: "activity" as const, activity: a })),
    ];
  }, [data, query]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(items.length - 1, 0)));
  }, [items]);

  if (!open) return null;

  function go(item: PaletteItem) {
    setOpen(false);
    if (item.kind === "nav") void navigate({ to: item.to });
    else void navigate({ to: "/activity/$id", params: { id: String(item.activity.id) } });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === "Enter" && items[activeIndex]) {
      go(items[activeIndex]);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex justify-center px-4 pt-[15vh]"
      onKeyDown={onKeyDown}
    >
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative w-full max-w-xl self-start rounded-[var(--radius-card)] border border-line bg-card shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <span aria-hidden="true" className="font-mono text-sm font-bold text-accent">
            &gt;
          </span>
          <input
            ref={inputRef}
            type="search"
            aria-label="Search activities and pages"
            placeholder="Jump to an activity or page…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm text-text outline-none placeholder:text-faint"
          />
        </div>

        <div className="max-h-[50vh] overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-3 py-2 text-sm text-muted">No matches.</p>
          ) : (
            items.map((item, i) => {
              const isActivity = item.kind === "activity";
              const category = isActivity ? SPORT_CATEGORY[item.activity.sport_type] : null;
              return (
                <button
                  key={isActivity ? String(item.activity.id) : item.to}
                  type="button"
                  onClick={() => go(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={clsx(
                    "flex w-full items-center gap-3 rounded-[var(--radius-control)] px-3 py-2 text-left transition-colors",
                    i === activeIndex ? "bg-raised text-text" : "text-muted",
                  )}
                >
                  {isActivity ? (
                    <span
                      aria-hidden="true"
                      className={clsx(
                        "size-2 flex-none rounded-full",
                        category ? CATEGORY_COLOR[category] : "bg-muted",
                      )}
                    />
                  ) : (
                    <span aria-hidden="true" className="w-2 flex-none text-center font-mono text-xs font-bold text-accent">
                      &gt;
                    </span>
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">
                    {isActivity ? item.activity.name : item.label}
                  </span>
                  {isActivity ? (
                    <span className="flex-none font-mono text-xs text-faint">
                      {formatDistance(item.activity.distance)} km · {item.activity.local_date}
                    </span>
                  ) : (
                    <span aria-hidden="true" className="flex-none font-mono text-xs text-faint">
                      ↵
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-line px-4 py-2">
          <p className="font-mono text-[11px] text-faint">↑↓ navigate · ↵ open · esc close</p>
        </div>
      </div>
    </div>
  );
}