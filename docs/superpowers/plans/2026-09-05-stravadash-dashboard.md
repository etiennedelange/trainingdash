# Trainingdash Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A dark, installable dashboard that renders the whole activity history, updates live when something lands, and shows a route map for any activity.

**Architecture:** The SPA fetches every activity once as slim rows, caches them in TanStack Query, and computes every statistic in the browser with pure functions from `shared/aggregate.ts`. A WebSocket invalidates that cache when the Worker pushes a change.

**Tech Stack:** React 19, TanStack Router + Query, Tailwind 4, shadcn/ui, Motion, Apache ECharts, MapLibre GL, `vite-plugin-pwa`, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-05-stravadash-design.md`

**Plan 2 of 3.** Requires Plan 1 (`2026-09-05-stravadash-data-pipeline.md`) complete and green. Plan 3 is the Coach.

## Global Constraints

- **All aggregation happens in the browser.** `shared/aggregate.ts` imports nothing and touches no I/O. No `/api/stats` endpoint exists or should be added.
- **The WebSocket is an optimisation, never the source of truth.** Every screen must be correct after a plain refetch. Refetch on reconnect and on `visibilitychange`.
- **Design tokens come from the approved canvas** (artifact `c7896ba6`), listed in Task 1. Use the token names, never raw hex, in components.
- **Chart form is chosen on the merits, not copied from the comp.** ECharts where density or interaction justifies it; plain SVG or CSS for simple bars.
- **TypeScript strict**, `noUncheckedIndexedAccess` — indexed access yields `T | undefined`.
- **pnpm 11 rules** in `pnpm-workspace.yaml` are authoritative. A dependency with a build script must be added to `allowBuilds` with a justifying comment.
- **Commit after every task.**

## File Structure

| File | Responsibility |
|---|---|
| `src/styles.css` | Tailwind 4 import and the `@theme` token block |
| `src/main.tsx` | Root render, providers |
| `src/router.tsx` | TanStack Router tree |
| `src/lib/api.ts` | Typed fetch wrapper for `/api/*` |
| `src/lib/queries.ts` | Query keys and options — one place, so invalidation matches |
| `src/hooks/useLiveUpdates.ts` | WebSocket lifecycle, reconnect, visibility refetch |
| `shared/aggregate.ts` | Pure statistics: streaks, buckets, mixes, totals |
| `src/charts/useEChart.ts` | ECharts instance lifecycle |
| `src/charts/*.tsx` | One component per chart |
| `src/map/polyline.ts` | Google encoded-polyline decoder |
| `src/map/RouteMap.tsx` | MapLibre route render |
| `src/components/*` | Shell, tiles, activity rows |
| `src/routes/*` | Screens |
| `worker/db/push.ts`, `worker/push/send.ts` | Web Push storage and delivery |
| `migrations/0002_push.sql` | `push_subscriptions` table |
| `e2e/*.spec.ts` | Playwright |

---

### Task 1: Tailwind 4, design tokens, and the app shell

**Files:**
- Create: `src/styles.css`, `src/components/Shell.tsx`
- Modify: `src/main.tsx`, `vite.config.ts`, `index.html`
- Test: `src/components/Shell.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces: the token names below, and `<Shell nav={...}>{children}</Shell>`.

- [ ] **Step 1: Install**

```bash
pnpm add -D tailwindcss @tailwindcss/vite
pnpm add motion clsx tailwind-merge
pnpm add -D vitest-browser-react @vitest/browser playwright
```

`@tailwindcss/oxide` is already in `allowBuilds` in `pnpm-workspace.yaml`.

- [ ] **Step 2: Write `src/styles.css`**

Tokens are transcribed from the approved canvas. Components reference these names, never the hex.

```css
@import "tailwindcss";

@theme {
  --color-ground: #0b0f14;
  --color-surface: #0e141b;
  --color-card: #141b23;
  --color-raised: #1d2530;
  --color-line: rgb(255 255 255 / 0.08);

  --color-text: #f1f4f7;
  --color-muted: #8792a0;
  --color-faint: #5b6472;

  --color-accent: #2dd4bf;
  --color-accent-deep: #0e9488;
  --color-warm-from: #ff8a5c;
  --color-warm-to: #ffd166;

  --color-run: #2dd4bf;
  --color-strength: #f472b6;
  --color-ride: #a78bfa;
  --color-walk: #60a5fa;

  --font-display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --font-sans: "Manrope", ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;

  --radius-tile: 15px;
  --radius-card: 18px;
}

html { background: var(--color-ground); color-scheme: dark; }
body { margin: 0; font-family: var(--font-sans); color: var(--color-text); }

@keyframes toast-in {
  from { opacity: 0; transform: translateY(-8px) scale(0.98); }
  to   { opacity: 1; transform: none; }
}
.animate-toast-in { animation: toast-in .5s cubic-bezier(.2,.8,.2,1) both; }
```

- [ ] **Step 3: Wire Tailwind and the fonts**

In `vite.config.ts`, add the plugin:

```ts
import tailwindcss from "@tailwindcss/vite";
// plugins: [react(), tailwindcss()]
```

In `index.html`, inside `<head>`, add the font links and update the title:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@500;600;700&family=Space+Grotesk:wght@600;700&family=JetBrains+Mono:wght@600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 4: Write the failing test**

`src/components/Shell.test.tsx`:

```tsx
import { render, screen } from "vitest-browser-react";
import { describe, it, expect } from "vitest";
import { Shell } from "./Shell";

describe("Shell", () => {
  it("renders the brand and its children", async () => {
    render(<Shell><p>content</p></Shell>);
    await expect.element(screen.getByText("Trainingdash")).toBeInTheDocument();
    await expect.element(screen.getByText("content")).toBeInTheDocument();
  });

  it("marks the active nav item", async () => {
    render(<Shell activeKey="progress"><p>x</p></Shell>);
    const link = screen.getByRole("link", { name: "Progress" });
    await expect.element(link).toHaveAttribute("aria-current", "page");
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/components/Shell.test.tsx`
Expected: FAIL — module `./Shell` not found.

- [ ] **Step 6: Write `src/components/Shell.tsx`**

```tsx
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
}: {
  children: ReactNode;
  activeKey?: string;
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
      </nav>

      <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
```

- [ ] **Step 7: Configure the browser test project**

In `vitest.config.ts`, the Worker pool and a browser pool cannot share one project. Add a `projects` array so both run under `pnpm test`:

```ts
// alongside the existing workers config, wrap both in:
// test: { projects: [ { /* existing workers config, name: "worker" */ }, browserProject ] }
const browserProject = {
  test: {
    name: "browser",
    include: ["src/**/*.test.{ts,tsx}"],
    browser: {
      enabled: true,
      provider: "playwright",
      instances: [{ browser: "chromium" }],
      headless: true,
    },
  },
};
```

- [ ] **Step 8: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser`
Expected: PASS, 2 tests.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add Tailwind 4 tokens and the app shell"
```

---

### Task 2: `shared/aggregate.ts` — the statistics layer

This is the densest test file in the project. It is where the gamification layer will later grow, and it is pure, so it is cheap to test exhaustively.

**Files:**
- Create: `shared/aggregate.ts`
- Test: `shared/aggregate.test.ts`

**Interfaces:**
- Consumes: `ActivitySummary` from `shared/types.ts` (Plan 1, Task 9).
- Produces:
  - `Totals { count, distance, movingTime, elevation }`
  - `Streak { current, longest, lastActiveDate }`
  - `WeekBucket { weekStart, distance, movingTime, count }`
  - `SportSlice { sport, count, distance, pct }`
  - `activeDays(rows): string[]` — sorted unique `local_date`
  - `computeStreak(rows, today): Streak`
  - `weeklyBuckets(rows, weeks, today): WeekBucket[]`
  - `sportMix(rows): SportSlice[]`
  - `totalsBetween(rows, from, to): Totals`

- [ ] **Step 1: Write the failing test**

`shared/aggregate.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { ActivitySummary } from "./types";
import { activeDays, computeStreak, weeklyBuckets, sportMix, totalsBetween } from "./aggregate";

const a = (local_date: string, over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id: Math.random(),
  name: "Run",
  sport_type: "Run",
  start_date: `${local_date}T10:00:00Z`,
  local_date,
  elapsed_time: 1800,
  moving_time: 1800,
  distance: 5000,
  total_elevation_gain: 10,
  average_speed: 2.78,
  average_heartrate: 150,
  suffer_score: 20,
  updated_at: 1,
  ...over,
});

describe("activeDays", () => {
  it("dedupes and sorts", () => {
    expect(activeDays([a("2026-09-03"), a("2026-09-01"), a("2026-09-03")]))
      .toEqual(["2026-09-01", "2026-09-03"]);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const rows = [a("2026-09-06"), a("2026-09-05"), a("2026-09-04")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(3);
  });

  it("keeps the streak alive when today has no activity yet but yesterday did", () => {
    const rows = [a("2026-09-05"), a("2026-09-04")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(2);
  });

  it("breaks the streak after a missed day", () => {
    const rows = [a("2026-09-04"), a("2026-09-03")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(0);
  });

  it("counts two activities on one day as one day", () => {
    const rows = [a("2026-09-06"), a("2026-09-06"), a("2026-09-05")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(2);
  });

  it("finds the longest historical streak even when the current one is shorter", () => {
    const rows = [
      a("2026-09-06"),
      a("2026-08-01"), a("2026-08-02"), a("2026-08-03"), a("2026-08-04"),
    ];
    const s = computeStreak(rows, "2026-09-06");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(4);
  });

  it("crosses a month boundary", () => {
    const rows = [a("2026-09-01"), a("2026-08-31"), a("2026-08-30")];
    expect(computeStreak(rows, "2026-09-01").current).toBe(3);
  });

  it("handles an empty history", () => {
    expect(computeStreak([], "2026-09-06")).toEqual({
      current: 0, longest: 0, lastActiveDate: null,
    });
  });
});

describe("weeklyBuckets", () => {
  it("buckets by ISO week starting Monday, newest last", () => {
    // 2026-09-06 is a Sunday; its week starts Monday 2026-08-31.
    const rows = [a("2026-09-06", { distance: 1000 }), a("2026-09-01", { distance: 2000 })];
    const buckets = weeklyBuckets(rows, 2, "2026-09-06");
    expect(buckets).toHaveLength(2);
    expect(buckets[1]?.weekStart).toBe("2026-08-31");
    expect(buckets[1]?.distance).toBe(3000);
  });

  it("emits zero-filled weeks with no activity", () => {
    const buckets = weeklyBuckets([], 3, "2026-09-06");
    expect(buckets).toHaveLength(3);
    expect(buckets.every((b) => b.count === 0 && b.distance === 0)).toBe(true);
  });

  it("ignores activities older than the window", () => {
    const buckets = weeklyBuckets([a("2020-01-01", { distance: 9999 })], 2, "2026-09-06");
    expect(buckets.reduce((n, b) => n + b.distance, 0)).toBe(0);
  });
});

describe("sportMix", () => {
  it("returns percentages that sum to 100 and are ordered by count", () => {
    const rows = [
      a("2026-09-01", { sport_type: "Run" }),
      a("2026-09-02", { sport_type: "Run" }),
      a("2026-09-03", { sport_type: "Ride" }),
      a("2026-09-04", { sport_type: "Walk" }),
    ];
    const mix = sportMix(rows);
    expect(mix[0]?.sport).toBe("Run");
    expect(mix[0]?.pct).toBe(50);
    expect(mix.reduce((n, m) => n + m.pct, 0)).toBe(100);
  });

  it("returns an empty array for no activities", () => {
    expect(sportMix([])).toEqual([]);
  });
});

describe("totalsBetween", () => {
  it("sums inclusively on both ends", () => {
    const rows = [
      a("2026-09-01", { distance: 1000, moving_time: 600, total_elevation_gain: 5 }),
      a("2026-09-05", { distance: 2000, moving_time: 900, total_elevation_gain: 15 }),
      a("2026-09-09", { distance: 4000 }),
    ];
    expect(totalsBetween(rows, "2026-09-01", "2026-09-05")).toEqual({
      count: 2, distance: 3000, movingTime: 1500, elevation: 20,
    });
  });

  it("treats a null elevation as zero", () => {
    const rows = [a("2026-09-01", { total_elevation_gain: null })];
    expect(totalsBetween(rows, "2026-09-01", "2026-09-01").elevation).toBe(0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run shared/aggregate.test.ts`
Expected: FAIL — module `./aggregate` not found.

- [ ] **Step 3: Write `shared/aggregate.ts`**

```ts
import type { ActivitySummary } from "./types";

export interface Totals {
  count: number;
  distance: number;
  movingTime: number;
  elevation: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

export interface WeekBucket {
  weekStart: string;
  distance: number;
  movingTime: number;
  count: number;
}

export interface SportSlice {
  sport: string;
  count: number;
  distance: number;
  pct: number;
}

/** Dates are YYYY-MM-DD strings throughout — never Date objects, which drag
 *  the runner's timezone into results that are already local by construction. */
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function activeDays(rows: ActivitySummary[]): string[] {
  return [...new Set(rows.map((r) => r.local_date))].sort();
}

export function computeStreak(rows: ActivitySummary[], today: string): Streak {
  const days = activeDays(rows);
  if (days.length === 0) return { current: 0, longest: 0, lastActiveDate: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const cur = days[i];
    if (prev === undefined || cur === undefined) continue;
    run = addDays(prev, 1) === cur ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const last = days[days.length - 1] ?? null;

  // Today with no activity yet does not end a streak; the day before does.
  let anchor: string | null = null;
  if (last === today) anchor = today;
  else if (last === addDays(today, -1)) anchor = last;

  let current = 0;
  if (anchor) {
    const set = new Set(days);
    let cursor = anchor;
    while (set.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest, lastActiveDate: last };
}

export function weeklyBuckets(
  rows: ActivitySummary[],
  weeks: number,
  today: string,
): WeekBucket[] {
  const thisMonday = mondayOf(today);
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) starts.push(addDays(thisMonday, -7 * i));

  const buckets = new Map<string, WeekBucket>(
    starts.map((weekStart) => [weekStart, { weekStart, distance: 0, movingTime: 0, count: 0 }]),
  );

  for (const r of rows) {
    const bucket = buckets.get(mondayOf(r.local_date));
    if (!bucket) continue;
    bucket.distance += r.distance;
    bucket.movingTime += r.moving_time;
    bucket.count += 1;
  }

  return starts.map((s) => buckets.get(s)!);
}

export function sportMix(rows: ActivitySummary[]): SportSlice[] {
  if (rows.length === 0) return [];

  const by = new Map<string, { count: number; distance: number }>();
  for (const r of rows) {
    const cur = by.get(r.sport_type) ?? { count: 0, distance: 0 };
    cur.count += 1;
    cur.distance += r.distance;
    by.set(r.sport_type, cur);
  }

  const slices = [...by.entries()]
    .map(([sport, v]) => ({ sport, ...v, pct: 0 }))
    .sort((x, y) => y.count - x.count || x.sport.localeCompare(y.sport));

  // Largest-remainder, so the percentages always total exactly 100.
  const exact = slices.map((s) => (s.count / rows.length) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((n, f) => n + f, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder -= 1;
  }

  return slices.map((s, i) => ({ ...s, pct: floors[i] ?? 0 }));
}

export function totalsBetween(
  rows: ActivitySummary[],
  from: string,
  to: string,
): Totals {
  const totals: Totals = { count: 0, distance: 0, movingTime: 0, elevation: 0 };
  for (const r of rows) {
    if (r.local_date < from || r.local_date > to) continue;
    totals.count += 1;
    totals.distance += r.distance;
    totals.movingTime += r.moving_time;
    totals.elevation += r.total_elevation_gain ?? 0;
  }
  return totals;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run shared/aggregate.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the pure aggregation layer"
```

---

### Task 3: API client, query layer, and the router

**Files:**
- Create: `src/lib/api.ts`, `src/lib/queries.ts`, `src/router.tsx`, `src/routes/__root.tsx`, `src/routes/index.tsx`
- Modify: `src/main.tsx`
- Test: `src/lib/api.test.ts`

**Interfaces:**
- Consumes: `ActivitySummary`, `ActivityRow` from `shared/types.ts`.
- Produces:
  - `ApiError { status: number }`
  - `apiGet<T>(path: string): Promise<T>`
  - `queryKeys = { me: ["me"], activities: ["activities"], activity: (id) => ["activity", id] }`
  - `activitiesQuery`, `meQuery`, `activityQuery(id)` — TanStack Query options objects

- [ ] **Step 1: Write the failing test**

`src/lib/api.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { apiGet, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("apiGet", () => {
  it("returns the parsed body on 200", async () => {
    stubFetch(200, { ok: true });
    expect(await apiGet<{ ok: boolean }>("/api/health")).toEqual({ ok: true });
  });

  it("throws ApiError carrying the status on failure", async () => {
    stubFetch(401, { error: "unauthorized" });
    await expect(apiGet("/api/me")).rejects.toBeInstanceOf(ApiError);
    await expect(apiGet("/api/me")).rejects.toMatchObject({ status: 401 });
  });

  it("sends credentials so the session cookie rides along", async () => {
    stubFetch(200, {});
    await apiGet("/api/me");
    expect(fetch).toHaveBeenCalledWith("/api/me", expect.objectContaining({
      credentials: "same-origin",
    }));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/lib/api.test.ts`
Expected: FAIL — module `./api` not found.

- [ ] **Step 3: Write `src/lib/api.ts`**

```ts
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "ApiError";
  }
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { credentials: "same-origin" });
  if (!res.ok) throw new ApiError(res.status, `GET ${path} failed: ${res.status}`);
  return (await res.json()) as T;
}
```

- [ ] **Step 3b: Add `ActivityDetail` to `shared/types.ts`**

The shipped `GET /api/activities/:id` already strips `raw` (commit `01cad48`),
but no type names that shape. Add one so the client is not typed as receiving a
field the server never sends:

```ts
/** One activity in full. `raw` is server-only and never reaches the client. */
export type ActivityDetail = Omit<ActivityRow, "raw">;
```

Then confirm `worker/routes/api.ts`'s detail handler returns that type rather
than `ActivityRow`, and add `satisfies ActivityDetail` to its response if it
does not already.

- [ ] **Step 4: Write `src/lib/queries.ts`**

Query keys live in one place so `useLiveUpdates` invalidates exactly what the screens read.

```ts
import { queryOptions } from "@tanstack/react-query";
import type { ActivitySummary, ActivityDetail, BackfillState } from "#shared/types";
import { apiGet } from "./api";

export interface Me {
  athleteId: number;
  connected: boolean;
  backfill: BackfillState;
}

export const queryKeys = {
  me: ["me"] as const,
  activities: ["activities"] as const,
  activity: (id: number) => ["activity", id] as const,
};

export const meQuery = queryOptions({
  queryKey: queryKeys.me,
  queryFn: () => apiGet<Me>("/api/me"),
});

export const activitiesQuery = queryOptions({
  queryKey: queryKeys.activities,
  queryFn: () => apiGet<ActivitySummary[]>("/api/activities"),
  // The whole history is a few megabytes and only changes on a push.
  staleTime: 5 * 60 * 1000,
});

export const activityQuery = (id: number) =>
  queryOptions({
    queryKey: queryKeys.activity(id),
    queryFn: () => apiGet<ActivityDetail>(`/api/activities/${id}`),
  });
```

- [ ] **Step 5: Write the router and root route**

`src/routes/__root.tsx`:

```tsx
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
```

`src/routes/index.tsx`:

```tsx
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";

function Today() {
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Today</h1>
      <p className="mt-1 text-sm text-muted">{data.length} activities</p>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: Today,
});
```

`src/router.tsx`:

```tsx
import { createRouter } from "@tanstack/react-router";
import { Route as rootRoute } from "./routes/__root";
import { Route as indexRoute } from "./routes/index";

const routeTree = rootRoute.addChildren([indexRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
```

- [ ] **Step 6: Write `src/main.tsx`**

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles.css";

const queryClient = new QueryClient();
const el = document.getElementById("root");

if (el) {
  createRoot(el).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  );
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `pnpm exec vitest run --project browser src/lib/api.test.ts`
Expected: PASS, 3 tests. (`useLiveUpdates` is written in Task 4; create it as an empty `export function useLiveUpdates() {}` stub now so the root route compiles, and replace it there.)

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add API client, query layer, and the router"
```

---

### Task 4: Live updates over the WebSocket

**Files:**
- Create: `src/hooks/useLiveUpdates.ts`
- Test: `src/hooks/useLiveUpdates.test.ts`

**Interfaces:**
- Consumes: `queryKeys` (Task 3), `LiveMessage` (Plan 1, Task 7).
- Produces: `useLiveUpdates(): { connected: boolean }`.

- [ ] **Step 1: Write the failing test**

`src/hooks/useLiveUpdates.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "vitest-browser-react";
import { createElement, type ReactNode } from "react";
import { useLiveUpdates } from "./useLiveUpdates";

class FakeSocket {
  static last: FakeSocket | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
}

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function Probe() {
  useLiveUpdates();
  return null;
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  FakeSocket.last = null;
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("useLiveUpdates", () => {
  it("connects to /live on the current origin", () => {
    const Wrapper = wrap(client);
    render(createElement(Wrapper, null, createElement(Probe)));
    expect(FakeSocket.last?.url).toMatch(/\/live$/);
    expect(FakeSocket.last?.url).toMatch(/^wss?:/);
  });

  it("invalidates the activities cache on an upsert message", () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const Wrapper = wrap(client);
    render(createElement(Wrapper, null, createElement(Probe)));

    FakeSocket.last?.onmessage?.({
      data: JSON.stringify({ type: "activity.upsert", activity: { id: 1 } }),
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["activities"] });
  });

  it("refetches on reconnect", () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const Wrapper = wrap(client);
    render(createElement(Wrapper, null, createElement(Probe)));

    FakeSocket.last?.onopen?.();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["activities"] });
  });

  it("ignores a message that is not valid JSON", () => {
    const Wrapper = wrap(client);
    render(createElement(Wrapper, null, createElement(Probe)));
    expect(() => FakeSocket.last?.onmessage?.({ data: "garbage" })).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/hooks/useLiveUpdates.test.ts`
Expected: FAIL — `useLiveUpdates` is a no-op stub, so no socket is created.

- [ ] **Step 3: Write `src/hooks/useLiveUpdates.ts`**

```ts
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { LiveMessage } from "#shared/types";
import { queryKeys } from "@/lib/queries";

const MAX_BACKOFF = 30_000;

/**
 * Holds the live socket. The socket is an optimisation, never the source of
 * truth: every path here ends in invalidating the activities cache, so a
 * dropped connection or a missed event self-corrects on the next refetch.
 */
export function useLiveUpdates(): { connected: boolean } {
  const queryClient = useQueryClient();
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let backoff = 1000;
    let disposed = false;

    const refetch = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.activities });
    };

    const connect = () => {
      if (disposed) return;
      const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
      socket = new WebSocket(`${proto}//${window.location.host}/live`);

      socket.onopen = () => {
        backoff = 1000;
        setConnected(true);
        // Close whatever gap the disconnection opened.
        refetch();
      };

      socket.onmessage = (event) => {
        let msg: LiveMessage;
        try {
          msg = JSON.parse(String(event.data)) as LiveMessage;
        } catch {
          return;
        }
        if (msg.type === "activity.upsert" || msg.type === "activity.delete") {
          refetch();
        }
      };

      socket.onclose = () => {
        setConnected(false);
        if (disposed) return;
        timer = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, MAX_BACKOFF);
      };
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") refetch();
    };

    connect();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      disposed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      if (timer) clearTimeout(timer);
      socket?.close();
    };
  }, [queryClient]);

  return { connected };
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/hooks/useLiveUpdates.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add live updates over the WebSocket"
```

---

### Task 5: The Today screen

**Files:**
- Create: `src/components/StatTile.tsx`, `src/components/ActivityRow.tsx`, `src/lib/format.ts`
- Modify: `src/routes/index.tsx`
- Test: `src/lib/format.test.ts`, `src/routes/index.test.tsx`

**Interfaces:**
- Consumes: `computeStreak`, `totalsBetween`, `activitiesQuery`.
- Produces:
  - `formatDistance(metres): string`, `formatDuration(seconds): string`, `formatPace(secondsPerKm): string`
  - `<StatTile label value unit accent? />`
  - `<ActivityRow activity />`

- [ ] **Step 1: Write the failing formatter test**

`src/lib/format.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { formatDistance, formatDuration, formatPace } from "./format";

describe("formatDistance", () => {
  it("renders kilometres to two decimals", () => {
    expect(formatDistance(6420)).toBe("6.42");
  });
  it("renders zero", () => {
    expect(formatDistance(0)).toBe("0.00");
  });
});

describe("formatDuration", () => {
  it("renders mm:ss under an hour", () => {
    expect(formatDuration(2052)).toBe("34:12");
  });
  it("renders h:mm:ss at or over an hour", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });
  it("pads seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
  });
});

describe("formatPace", () => {
  it("renders minutes per kilometre", () => {
    // 6420 m in 2052 s → 319.6 s/km → 5:20
    expect(formatPace(2052 / 6.42)).toBe("5:20");
  });
  it("returns a dash for a non-finite pace", () => {
    expect(formatPace(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatPace(Number.NaN)).toBe("—");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/lib/format.test.ts`
Expected: FAIL — module `./format` not found.

- [ ] **Step 3: Write `src/lib/format.ts`**

```ts
export function formatDistance(metres: number): string {
  return (metres / 1000).toFixed(2);
}

export function formatDuration(seconds: number): string {
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
}

export function formatPace(secondsPerKm: number): string {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return "—";
  const m = Math.floor(secondsPerKm / 60);
  const s = Math.round(secondsPerKm % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function todayLocalDate(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}
```

`todayLocalDate` deliberately shifts by the offset before slicing — `toISOString()` alone would give the UTC date, which is wrong for anyone training late in the evening east of Greenwich.

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/lib/format.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write `src/components/StatTile.tsx`**

```tsx
import clsx from "clsx";

export function StatTile({
  label,
  value,
  unit,
  accent = false,
}: {
  label: string;
  value: string;
  unit?: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-[var(--radius-tile)] border border-line bg-card p-4">
      <div className={clsx("font-mono text-2xl font-bold", accent ? "text-accent" : "text-text")}>
        {value}
        {unit ? <span className="ml-1 font-sans text-xs font-semibold text-muted">{unit}</span> : null}
      </div>
      <div className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
        {label}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `src/components/ActivityRow.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import type { ActivitySummary } from "#shared/types";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";

const SPORT_COLOR: Record<string, string> = {
  Run: "bg-run",
  TrailRun: "bg-run",
  Ride: "bg-ride",
  VirtualRide: "bg-ride",
  Walk: "bg-walk",
  Hike: "bg-walk",
  WeightTraining: "bg-strength",
  Workout: "bg-strength",
};

export function ActivityRow({ activity }: { activity: ActivitySummary }) {
  const paceSecPerKm = activity.distance > 0
    ? activity.moving_time / (activity.distance / 1000)
    : Number.NaN;

  return (
    <Link
      to="/activity/$id"
      params={{ id: String(activity.id) }}
      className="flex items-center gap-3 rounded-[13px] border border-line bg-card px-4 py-3 transition-colors hover:bg-raised"
    >
      <span
        className={`size-2 flex-none rounded-full ${SPORT_COLOR[activity.sport_type] ?? "bg-muted"}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-sm font-bold">{activity.name}</span>
      <span className="font-mono text-xs text-muted">
        {formatDistance(activity.distance)} km · {formatDuration(activity.moving_time)} ·{" "}
        {formatPace(paceSecPerKm)}/km
      </span>
    </Link>
  );
}
```

- [ ] **Step 7: Write the failing screen test**

`src/routes/index.test.tsx`:

```tsx
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen } from "vitest-browser-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Today } from "./index";
import type { ActivitySummary } from "#shared/types";

const rows: ActivitySummary[] = [
  {
    id: 1, name: "Evening Run", sport_type: "Run",
    start_date: "2026-09-06T16:41:00Z", local_date: "2026-09-06",
    elapsed_time: 2052, moving_time: 2052, distance: 6420,
    total_elevation_gain: 48, average_speed: 3.13, average_heartrate: 152,
    suffer_score: 40, updated_at: 1,
  },
];

function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return render(
    <QueryClientProvider client={client}>
      <Today today="2026-09-06" />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe("Today", () => {
  it("shows the streak from the activity history", async () => {
    mount(rows);
    await expect.element(screen.getByText("1")).toBeInTheDocument();
    await expect.element(screen.getByText(/day streak/i)).toBeInTheDocument();
  });

  it("lists recent activities", async () => {
    mount(rows);
    await expect.element(screen.getByText("Evening Run")).toBeInTheDocument();
  });

  it("shows an empty state when nothing has been imported", async () => {
    mount([]);
    await expect.element(screen.getByText(/no activities yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 8: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/routes/index.test.tsx`
Expected: FAIL — `Today` is not exported.

- [ ] **Step 9: Rewrite `src/routes/index.tsx`**

`Today` takes `today` as a prop so the test can pin the date rather than mock the clock.

```tsx
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { computeStreak, totalsBetween } from "#shared/aggregate";
import { StatTile } from "@/components/StatTile";
import { ActivityRow } from "@/components/ActivityRow";
import { formatDistance, formatDuration, todayLocalDate } from "@/lib/format";

export function Today({ today }: { today: string }) {
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;

  const streak = computeStreak(data, today);
  const weekStart = new Date(`${today}T00:00:00Z`);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const week = totalsBetween(data, weekStart.toISOString().slice(0, 10), today);

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Today</h1>

      {data.length === 0 ? (
        <p className="mt-6 text-sm text-muted">
          No activities yet — the import runs in the background after you connect.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="day streak" value={String(streak.current)} accent />
            <StatTile label="longest streak" value={String(streak.longest)} />
            <StatTile label="this week" value={formatDistance(week.distance)} unit="km" />
            <StatTile label="time this week" value={formatDuration(week.movingTime)} />
          </div>

          <h2 className="mt-10 mb-3 text-sm font-bold text-muted">Recent activities</h2>
          <div className="flex flex-col gap-2">
            {data.slice(0, 10).map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: () => <Today today={todayLocalDate()} />,
});
```

- [ ] **Step 10: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/routes/index.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add the Today screen"
```

---

### Task 6: ECharts hook and the two charts that earn it

**Files:**
- Create: `src/charts/useEChart.ts`, `src/charts/WeeklyDistance.tsx`, `src/charts/ActivityCalendar.tsx`
- Test: `src/charts/useEChart.test.tsx`

**Interfaces:**
- Consumes: `WeekBucket`, `activeDays`.
- Produces:
  - `useEChart(option: EChartsOption): RefObject<HTMLDivElement | null>`
  - `<WeeklyDistance buckets={WeekBucket[]} />`
  - `<ActivityCalendar days={string[]} year={number} />`

- [ ] **Step 1: Install ECharts**

```bash
pnpm add echarts
```

ECharts has no install script, so `allowBuilds` needs no change.

- [ ] **Step 2: Write the failing test**

`src/charts/useEChart.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "vitest-browser-react";
import { useEChart } from "./useEChart";

function Bars() {
  const ref = useEChart({
    xAxis: { type: "category", data: ["a", "b"] },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: [1, 2] }],
  });
  return <div ref={ref} data-testid="chart" style={{ width: 300, height: 200 }} />;
}

describe("useEChart", () => {
  it("mounts a canvas into the container", async () => {
    render(<Bars />);
    const el = screen.getByTestId("chart");
    await expect.element(el).toBeInTheDocument();
    await expect
      .poll(() => el.element().querySelector("canvas"))
      .toBeTruthy();
  });

  it("disposes cleanly on unmount", async () => {
    const { unmount } = render(<Bars />);
    expect(() => unmount()).not.toThrow();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/charts/useEChart.test.tsx`
Expected: FAIL — module `./useEChart` not found.

- [ ] **Step 4: Write `src/charts/useEChart.ts`**

Only the pieces actually used are registered, so the bundle carries no chart types the app never draws.

```ts
import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  CalendarComponent,
  VisualMapComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { EChartsOption } from "echarts";

echarts.use([
  BarChart,
  HeatmapChart,
  GridComponent,
  TooltipComponent,
  CalendarComponent,
  VisualMapComponent,
  CanvasRenderer,
]);

/**
 * Owns one ECharts instance for one container: create on mount, resize with a
 * ResizeObserver, dispose on unmount. `echarts-for-react` is deliberately not
 * used — it is community-maintained and has lagged React major versions.
 */
export function useEChart(option: EChartsOption) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const chart = echarts.init(el, null, { renderer: "canvas" });
    chartRef.current = chart;

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(el);

    return () => {
      observer.disconnect();
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    // `true` replaces the option rather than merging, so removed series vanish.
    chartRef.current?.setOption(option, true);
  }, [option]);

  return containerRef;
}
```

- [ ] **Step 5: Write `src/charts/WeeklyDistance.tsx`**

```tsx
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import type { WeekBucket } from "#shared/aggregate";
import { useEChart } from "./useEChart";

export function WeeklyDistance({ buckets }: { buckets: WeekBucket[] }) {
  const option = useMemo<EChartsOption>(
    () => ({
      grid: { left: 44, right: 12, top: 16, bottom: 28 },
      tooltip: {
        trigger: "axis",
        valueFormatter: (v) => `${((v as number) / 1000).toFixed(1)} km`,
      },
      xAxis: {
        type: "category",
        data: buckets.map((b) => b.weekStart.slice(5)),
        axisLine: { lineStyle: { color: "#1d2530" } },
        axisLabel: { color: "#5b6472", fontSize: 10 },
      },
      yAxis: {
        type: "value",
        splitLine: { lineStyle: { color: "#1d2530" } },
        axisLabel: {
          color: "#5b6472",
          fontSize: 10,
          formatter: (v: number) => `${v / 1000}k`,
        },
      },
      series: [
        {
          type: "bar",
          data: buckets.map((b) => b.distance),
          itemStyle: { color: "#2dd4bf", borderRadius: [4, 4, 0, 0] },
        },
      ],
    }),
    [buckets],
  );

  const ref = useEChart(option);
  return <div ref={ref} className="h-[220px] w-full" />;
}
```

- [ ] **Step 6: Write `src/charts/ActivityCalendar.tsx`**

This is the chart that justifies ECharts: a year-long day grid is tedious to hand-roll and trivial here.

```tsx
import { useMemo } from "react";
import type { EChartsOption } from "echarts";
import { useEChart } from "./useEChart";

export function ActivityCalendar({ days, year }: { days: string[]; year: number }) {
  const option = useMemo<EChartsOption>(() => {
    const counts = new Map<string, number>();
    for (const d of days) counts.set(d, (counts.get(d) ?? 0) + 1);
    const data = [...counts.entries()].filter(([d]) => d.startsWith(String(year)));

    return {
      tooltip: { formatter: (p) => `${(p as { data: [string, number] }).data[0]}` },
      visualMap: {
        show: false,
        min: 0,
        max: 3,
        inRange: { color: ["#141b23", "#0e9488", "#2dd4bf"] },
      },
      calendar: {
        range: String(year),
        cellSize: [14, 14],
        left: 40,
        right: 10,
        itemStyle: { color: "#0e141b", borderColor: "#0b0f14", borderWidth: 2 },
        splitLine: { show: false },
        yearLabel: { show: false },
        dayLabel: { color: "#5b6472", fontSize: 10 },
        monthLabel: { color: "#8792a0", fontSize: 10 },
      },
      series: [{ type: "heatmap", coordinateSystem: "calendar", data }],
    };
  }, [days, year]);

  const ref = useEChart(option);
  return <div ref={ref} className="h-[180px] w-full" />;
}
```

- [ ] **Step 7: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/charts/useEChart.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add the ECharts hook, weekly distance, and activity calendar"
```

---

### Task 7: Activities screen — timeline and calendar

**Files:**
- Create: `src/routes/activities.tsx`
- Modify: `src/router.tsx`
- Test: `src/routes/activities.test.tsx`

**Interfaces:**
- Consumes: `activitiesQuery`, `activeDays`, `computeStreak`, `<ActivityCalendar>`, `<ActivityRow>`, `<StatTile>`.
- Produces: `<Activities today={string} />` and the `/activities` route.

- [ ] **Step 1: Write the failing test**

`src/routes/activities.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "vitest-browser-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Activities } from "./activities";
import type { ActivitySummary } from "#shared/types";

const row = (id: number, local_date: string): ActivitySummary => ({
  id, name: `Run ${id}`, sport_type: "Run",
  start_date: `${local_date}T10:00:00Z`, local_date,
  elapsed_time: 1800, moving_time: 1800, distance: 5000,
  total_elevation_gain: 0, average_speed: 2.78, average_heartrate: 140,
  suffer_score: 10, updated_at: 1,
});

function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return render(
    <QueryClientProvider client={client}>
      <Activities today="2026-09-06" />
    </QueryClientProvider>,
  );
}

describe("Activities", () => {
  it("defaults to the timeline tab", async () => {
    mount([row(1, "2026-09-06")]);
    await expect.element(screen.getByText("Run 1")).toBeInTheDocument();
  });

  it("switches to the calendar tab", async () => {
    mount([row(1, "2026-09-06")]);
    await screen.getByRole("tab", { name: "Calendar" }).click();
    await expect.element(screen.getByTestId("calendar")).toBeInTheDocument();
  });

  it("counts distinct active days, not activities", async () => {
    mount([row(1, "2026-09-06"), row(2, "2026-09-06"), row(3, "2026-09-05")]);
    await expect.element(screen.getByTestId("active-days")).toHaveTextContent("2");
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/routes/activities.test.tsx`
Expected: FAIL — module `./activities` not found.

- [ ] **Step 3: Write `src/routes/activities.tsx`**

```tsx
import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import clsx from "clsx";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { activeDays, computeStreak } from "#shared/aggregate";
import { ActivityRow } from "@/components/ActivityRow";
import { ActivityCalendar } from "@/charts/ActivityCalendar";
import { StatTile } from "@/components/StatTile";
import { todayLocalDate } from "@/lib/format";

const TABS = ["Timeline", "Calendar"] as const;

export function Activities({ today }: { today: string }) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("Timeline");
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;

  const days = activeDays(data);
  const streak = computeStreak(data, today);

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Activities</h1>
      <p className="mt-1 text-sm text-muted">History, calendar and streaks</p>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <div data-testid="active-days">
          <StatTile label="active days" value={String(days.length)} />
        </div>
        <StatTile label="longest streak" value={String(streak.longest)} />
        <StatTile label="activities" value={String(data.length)} />
      </div>

      <div role="tablist" className="mt-8 flex gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={clsx(
              "rounded-[10px] px-4 py-2 text-xs font-bold transition-colors",
              tab === t ? "bg-raised text-text" : "text-muted hover:bg-raised",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {tab === "Timeline" ? (
          <div className="flex flex-col gap-2">
            {data.map((a) => (
              <ActivityRow key={a.id} activity={a} />
            ))}
          </div>
        ) : (
          <div data-testid="calendar">
            <ActivityCalendar days={days} year={Number(today.slice(0, 4))} />
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activities",
  component: () => <Activities today={todayLocalDate()} />,
});
```

- [ ] **Step 4: Register the route in `src/router.tsx`**

```tsx
import { Route as activitiesRoute } from "./routes/activities";
const routeTree = rootRoute.addChildren([indexRoute, activitiesRoute]);
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/routes/activities.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the Activities screen"
```

---

### Task 8: Progress screen

**Files:**
- Create: `src/routes/progress.tsx`, `src/components/MixBar.tsx`
- Modify: `src/router.tsx`
- Test: `src/routes/progress.test.tsx`

**Interfaces:**
- Consumes: `weeklyBuckets`, `sportMix`, `totalsBetween`, `<WeeklyDistance>`.
- Produces: `<Progress today={string} />`, `<MixBar slices={SportSlice[]} />`, and the `/progress` route.

The workout-mix breakdown is four CSS bars, not a chart — this is the case the spec calls out where ECharts would be over-provisioned.

- [ ] **Step 1: Write the failing test**

`src/routes/progress.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "vitest-browser-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Progress } from "./progress";
import type { ActivitySummary } from "#shared/types";

const row = (id: number, local_date: string, sport_type: string): ActivitySummary => ({
  id, name: `A${id}`, sport_type,
  start_date: `${local_date}T10:00:00Z`, local_date,
  elapsed_time: 1800, moving_time: 1800, distance: 5000,
  total_elevation_gain: 0, average_speed: 2.78, average_heartrate: 140,
  suffer_score: 10, updated_at: 1,
});

function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return render(
    <QueryClientProvider client={client}>
      <Progress today="2026-09-06" />
    </QueryClientProvider>,
  );
}

describe("Progress", () => {
  it("renders a mix row per sport with its percentage", async () => {
    mount([
      row(1, "2026-09-01", "Run"),
      row(2, "2026-09-02", "Run"),
      row(3, "2026-09-03", "Ride"),
      row(4, "2026-09-04", "Walk"),
    ]);
    await expect.element(screen.getByText("Run")).toBeInTheDocument();
    await expect.element(screen.getByText("50%")).toBeInTheDocument();
  });

  it("shows an empty state with no data", async () => {
    mount([]);
    await expect.element(screen.getByText(/nothing to compare yet/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/routes/progress.test.tsx`
Expected: FAIL — module `./progress` not found.

- [ ] **Step 3: Write `src/components/MixBar.tsx`**

```tsx
import type { SportSlice } from "#shared/aggregate";

const COLOR: Record<string, string> = {
  Run: "var(--color-run)",
  TrailRun: "var(--color-run)",
  Ride: "var(--color-ride)",
  VirtualRide: "var(--color-ride)",
  Walk: "var(--color-walk)",
  Hike: "var(--color-walk)",
  WeightTraining: "var(--color-strength)",
  Workout: "var(--color-strength)",
};

export function MixBar({ slices }: { slices: SportSlice[] }) {
  return (
    <div className="flex flex-col gap-3">
      {slices.map((s) => (
        <div key={s.sport} className="flex items-center gap-3">
          <span className="w-24 flex-none truncate text-xs font-bold">{s.sport}</span>
          <span className="h-2 flex-1 overflow-hidden rounded-full bg-raised">
            <span
              className="block h-full rounded-full"
              style={{ width: `${s.pct}%`, background: COLOR[s.sport] ?? "var(--color-muted)" }}
            />
          </span>
          <span className="w-10 flex-none text-right font-mono text-xs text-muted">{s.pct}%</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Write `src/routes/progress.tsx`**

```tsx
import { createRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activitiesQuery } from "@/lib/queries";
import { weeklyBuckets, sportMix } from "#shared/aggregate";
import { WeeklyDistance } from "@/charts/WeeklyDistance";
import { MixBar } from "@/components/MixBar";
import { todayLocalDate } from "@/lib/format";

export function Progress({ today }: { today: string }) {
  const { data, isPending, isError } = useQuery(activitiesQuery);

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load activities.</p>;
  if (data.length === 0) {
    return <p className="p-10 text-sm text-muted">Nothing to compare yet.</p>;
  }

  return (
    <div className="p-10">
      <h1 className="font-display text-[27px] font-bold">Progress</h1>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-bold text-muted">Distance · last 8 weeks</h2>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-4">
          <WeeklyDistance buckets={weeklyBuckets(data, 8, today)} />
        </div>
      </section>

      <section className="mt-8 max-w-md">
        <h2 className="mb-3 text-sm font-bold text-muted">Workout mix</h2>
        <div className="rounded-[var(--radius-card)] border border-line bg-card p-5">
          <MixBar slices={sportMix(data)} />
        </div>
      </section>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/progress",
  component: () => <Progress today={todayLocalDate()} />,
});
```

- [ ] **Step 5: Register the route in `src/router.tsx`**

```tsx
import { Route as progressRoute } from "./routes/progress";
const routeTree = rootRoute.addChildren([indexRoute, activitiesRoute, progressRoute]);
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/routes/progress.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the Progress screen"
```

---

### Task 9: Activity detail and the route map

**Files:**
- Create: `src/map/polyline.ts`, `src/map/RouteMap.tsx`, `src/routes/activity.$id.tsx`
- Modify: `src/router.tsx`
- Test: `src/map/polyline.test.ts`

**Interfaces:**
- Consumes: `activityQuery`, `ActivityDetail`.
- Produces:
  - `decodePolyline(encoded: string): [number, number][]` — `[lng, lat]` pairs, GeoJSON order
  - `bounds(coords): [[number, number], [number, number]]`
  - `<RouteMap polyline={string} />`
  - the `/activity/$id` route

- [ ] **Step 1: Write the failing decoder test**

`src/map/polyline.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { decodePolyline, bounds } from "./polyline";

describe("decodePolyline", () => {
  it("decodes the reference string from Google's algorithm docs", () => {
    // _p~iF~ps|U_ulLnnqC_mqNvxq`@ → (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    const coords = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(coords).toHaveLength(3);
    // GeoJSON order: [lng, lat]
    expect(coords[0]?.[1]).toBeCloseTo(38.5, 5);
    expect(coords[0]?.[0]).toBeCloseTo(-120.2, 5);
    expect(coords[2]?.[1]).toBeCloseTo(43.252, 5);
    expect(coords[2]?.[0]).toBeCloseTo(-126.453, 5);
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

describe("bounds", () => {
  it("returns south-west then north-east corners", () => {
    expect(bounds([[-120.2, 38.5], [-126.453, 43.252]])).toEqual([
      [-126.453, 38.5],
      [-120.2, 43.252],
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/map/polyline.test.ts`
Expected: FAIL — module `./polyline` not found.

- [ ] **Step 3: Write `src/map/polyline.ts`**

```ts
/**
 * Google encoded-polyline decoder. Strava's `summary_polyline` uses precision 5.
 * Returns [lng, lat] pairs — GeoJSON order, which is what MapLibre expects and
 * the reverse of how the algorithm reads them.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]);
  }

  return coords;
}

export function bounds(
  coords: [number, number][],
): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/map/polyline.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Install MapLibre and choose a tile source**

```bash
pnpm add maplibre-gl
```

MapLibre is a renderer and ships **no tiles**. Before writing `RouteMap.tsx`, open
<https://openfreemap.org> and confirm a dark style URL that works without an
account, then use it as `STYLE_URL` below. If OpenFreeMap is unavailable or has
changed terms, Protomaps (<https://protomaps.com>) is the fallback; it needs a
different style setup, so check before committing to it. Record whichever you
pick in a comment.

- [ ] **Step 6: Write `src/map/RouteMap.tsx`**

```tsx
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { decodePolyline, bounds } from "./polyline";

// Tile source confirmed in Task 9 Step 5. MapLibre ships no tiles of its own.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const coords = decodePolyline(polyline);
    if (coords.length === 0) return;

    const map = new maplibregl.Map({
      container: el,
      style: STYLE_URL,
      bounds: bounds(coords),
      fitBoundsOptions: { padding: 32 },
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2dd4bf", "line-width": 3 },
      });
    });

    return () => map.remove();
  }, [polyline]);

  return <div ref={containerRef} className="h-[320px] w-full rounded-[var(--radius-card)]" />;
}
```

- [ ] **Step 7: Write `src/routes/activity.$id.tsx`**

```tsx
import { createRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { activityQuery } from "@/lib/queries";
import { RouteMap } from "@/map/RouteMap";
import { StatTile } from "@/components/StatTile";
import { formatDistance, formatDuration, formatPace } from "@/lib/format";

function ActivityDetail() {
  const { id } = useParams({ from: "/activity/$id" });
  const { data, isPending, isError } = useQuery(activityQuery(Number(id)));

  if (isPending) return <p className="p-10 text-muted">Loading…</p>;
  if (isError) return <p className="p-10 text-muted">Could not load that activity.</p>;

  const pace = data.distance > 0 ? data.moving_time / (data.distance / 1000) : Number.NaN;

  return (
    <div className="p-10">
      <Link to="/" className="text-xs font-bold text-muted hover:text-text">
        ← Back to Today
      </Link>

      <h1 className="mt-4 font-display text-[27px] font-bold">{data.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {data.local_date} · {data.sport_type}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="kilometers" value={formatDistance(data.distance)} accent />
        <StatTile label="duration" value={formatDuration(data.moving_time)} />
        <StatTile label="min / km" value={formatPace(pace)} />
        <StatTile
          label="avg heart rate"
          value={data.average_heartrate ? String(Math.round(data.average_heartrate)) : "—"}
          unit={data.average_heartrate ? "bpm" : undefined}
        />
      </div>

      {data.polyline ? (
        <div className="mt-8 overflow-hidden rounded-[var(--radius-card)] border border-line">
          <RouteMap polyline={data.polyline} />
        </div>
      ) : (
        <p className="mt-8 text-sm text-muted">No route recorded for this activity.</p>
      )}
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/activity/$id",
  component: ActivityDetail,
});
```

- [ ] **Step 8: Register the route in `src/router.tsx`**

```tsx
import { Route as activityRoute } from "./routes/activity.$id";
const routeTree = rootRoute.addChildren([
  indexRoute, activitiesRoute, progressRoute, activityRoute,
]);
```

- [ ] **Step 9: Verify the map renders against real data**

Run: `pnpm dev`, open an activity that has a route. The line should render in accent teal over dark tiles. A blank map with a console CSP or 403 error means the tile source from Step 5 is wrong.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add activity detail with the MapLibre route map"
```

---

### Task 10: PWA — installable, offline shell

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon-192.png`, `public/icon-512.png`, `src/components/UpdatePrompt.tsx`
- Test: manual (a service worker cannot be meaningfully asserted in a unit test)

**Interfaces:**
- Consumes: nothing.
- Produces: a registered service worker and `<UpdatePrompt />`.

- [ ] **Step 1: Install**

```bash
pnpm add -D vite-plugin-pwa
```

- [ ] **Step 2: Configure the plugin in `vite.config.ts`**

```ts
import { VitePWA } from "vite-plugin-pwa";

// inside plugins: [...]
VitePWA({
  registerType: "prompt",
  includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
  manifest: {
    name: "Trainingdash",
    short_name: "Trainingdash",
    description: "A gamified dashboard for your Strava activities",
    theme_color: "#0b0e13",
    background_color: "#0b0f14",
    display: "standalone",
    start_url: "/",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  },
  workbox: {
    globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
    // API responses are never precached — the dashboard must not show a
    // stale history that looks current. The shell is offline; the data is not.
    navigateFallbackDenylist: [/^\/api/, /^\/auth/, /^\/webhook/, /^\/live/],
  },
})
```

- [ ] **Step 3: Create the icons**

Export 192×192 and 512×512 PNGs of the bolt mark on the `#0b0f14` ground into `public/`. `.gitignore` excludes `*.png` but re-includes `!public/**`, so these commit.

- [ ] **Step 4: Write `src/components/UpdatePrompt.tsx`**

`registerType: "prompt"` means a new deploy waits rather than reloading under the user. This surfaces it.

```tsx
import { useRegisterSW } from "virtual:pwa-register/react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!needRefresh) return null;

  return (
    <div className="fixed right-5 bottom-5 z-50 flex items-center gap-3 rounded-[var(--radius-card)] border border-line bg-card px-4 py-3 shadow-2xl">
      <span className="text-xs font-semibold">A new version is ready.</span>
      <button
        onClick={() => void updateServiceWorker(true)}
        className="rounded-[10px] bg-accent px-3 py-1.5 text-xs font-bold text-ground"
      >
        Reload
      </button>
    </div>
  );
}
```

Render it in `src/routes/__root.tsx` inside `<Shell>`, after `<Outlet />`.

- [ ] **Step 5: Verify the install prompt**

Run: `pnpm build && pnpm exec vite preview`

In Chrome DevTools → Application: the manifest parses with no errors, a service worker is activated, and an install icon appears in the address bar. Install it and confirm it opens in its own window with no browser chrome.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: make the dashboard an installable PWA"
```

---

### Task 11: Web Push on activity arrival

**Files:**
- Create: `migrations/0002_push.sql`, `worker/db/push.ts`, `worker/push/send.ts`, `src/components/EnableNotifications.tsx`
- Modify: `worker/routes/api.ts`, `worker/sync/ingest.ts`, `worker/env.ts`, `src/routes/index.tsx`
- Test: `worker/db/push.test.ts`, `worker/routes/push.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `handleEvent`, `ActivityRow`.
- Produces:
  - `savePushSubscription(db, sub): Promise<void>`, `listPushSubscriptions(db): Promise<PushSubscriptionRow[]>`, `deletePushSubscription(db, endpoint): Promise<void>`
  - `notifyActivity(env, activity): Promise<void>`
  - `POST /api/push/subscribe`

- [ ] **Step 1: Write the migration**

`migrations/0002_push.sql`:

```sql
CREATE TABLE push_subscriptions (
  endpoint   TEXT PRIMARY KEY,
  keys       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

- [ ] **Step 2: Write the failing storage test**

`worker/db/push.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { savePushSubscription, listPushSubscriptions, deletePushSubscription } from "./push";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
});

const sub = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "key", auth: "auth" },
};

describe("push subscriptions", () => {
  it("saves and lists", async () => {
    await savePushSubscription(env.DB, sub);
    const all = await listPushSubscriptions(env.DB);
    expect(all).toHaveLength(1);
    expect(all[0]?.keys.p256dh).toBe("key");
  });

  it("is idempotent on the same endpoint", async () => {
    await savePushSubscription(env.DB, sub);
    await savePushSubscription(env.DB, sub);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(1);
  });

  it("deletes by endpoint", async () => {
    await savePushSubscription(env.DB, sub);
    await deletePushSubscription(env.DB, sub.endpoint);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run worker/db/push.test.ts`
Expected: FAIL — module `./push` not found.

- [ ] **Step 4: Write `worker/db/push.ts`**

```ts
export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  keys: PushKeys;
  created_at: number;
}

export async function savePushSubscription(
  db: D1Database,
  sub: { endpoint: string; keys: PushKeys },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, keys, created_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys`,
    )
    .bind(sub.endpoint, JSON.stringify(sub.keys), Math.floor(Date.now() / 1000))
    .run();
}

export async function listPushSubscriptions(db: D1Database): Promise<PushSubscriptionRow[]> {
  const { results } = await db
    .prepare("SELECT endpoint, keys, created_at FROM push_subscriptions")
    .all<{ endpoint: string; keys: string; created_at: number }>();
  return results.map((r) => ({ ...r, keys: JSON.parse(r.keys) as PushKeys }));
}

export async function deletePushSubscription(db: D1Database, endpoint: string): Promise<void> {
  await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1").bind(endpoint).run();
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm exec vitest run worker/db/push.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Choose and verify a Web Push library**

**Do not hand-roll this.** Web Push requires an ES256 VAPID JWT plus AES128GCM
payload encryption; a subtle mistake produces silently undelivered notifications.

`@block65/webcrypto-web-push` is the candidate — it targets WebCrypto rather
than Node's `crypto`, which is what a Worker needs. Before adopting it:

```bash
pnpm add @block65/webcrypto-web-push
pnpm exec vitest run worker/db/push.test.ts   # confirms nothing broke on install
```

Then write a one-off throwaway test that calls its `buildPushPayload`
equivalent inside the workers pool and asserts it returns a `Request` without
throwing. If it reaches for a Node-only API, drop it and search npm for a
Workers-compatible alternative before continuing. Record the decision in a
comment at the top of `worker/push/send.ts`.

Generate the VAPID keypair:

```bash
pnpm exec web-push generate-vapid-keys
```

Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` (a `mailto:` URL)
to `.dev.vars` and to `worker/env.ts`.

- [ ] **Step 7: Write `worker/push/send.ts`**

```ts
// Web Push is signed and encrypted per RFC 8291/8292. The library chosen in
// Task 11 Step 6 does both; do not reimplement either.
import type { Env } from "../env";
import type { ActivityRow } from "#shared/types";
import { listPushSubscriptions, deletePushSubscription } from "../db/push";

/**
 * Best-effort notification. Never allowed to affect the D1 write or the
 * WebSocket broadcast — a failure here is logged and dropped.
 */
export async function notifyActivity(env: Env, activity: ActivityRow): Promise<void> {
  const subs = await listPushSubscriptions(env.DB);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: `${activity.sport_type} uploaded`,
    body: `${(activity.distance / 1000).toFixed(2)} km`,
    url: `/activity/${activity.id}`,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const request = await buildPushRequest(env, sub, payload);
        const res = await fetch(request);
        // 404/410 mean the browser dropped the subscription — stop retrying it.
        if (res.status === 404 || res.status === 410) {
          await deletePushSubscription(env.DB, sub.endpoint);
        }
      } catch (err) {
        console.error("push send failed", sub.endpoint, err);
      }
    }),
  );
}
```

Implement `buildPushRequest` with the library selected in Step 6, passing
`env.VAPID_SUBJECT`, `env.VAPID_PUBLIC_KEY` and `env.VAPID_PRIVATE_KEY`.

- [ ] **Step 8: Add the subscribe endpoint**

In `worker/routes/api.ts`:

```ts
import { savePushSubscription } from "../db/push";

api.post("/push/subscribe", async (c) => {
  const body = (await c.req.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return c.json({ error: "malformed subscription" }, 400);
  }
  await savePushSubscription(c.env.DB, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  return c.json({ ok: true });
});
```

- [ ] **Step 9: Write the failing route test**

`worker/routes/push.test.ts`:

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { signSession } from "../session";
import { listPushSubscriptions } from "../db/push";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
});

async function post(body: unknown, withSession = true): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSession) headers.Cookie = `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
  return await SELF.fetch("http://example.com/api/push/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/push/subscribe", () => {
  it("401s without a session", async () => {
    const res = await post({ endpoint: "https://p/1", keys: { p256dh: "a", auth: "b" } }, false);
    expect(res.status).toBe(401);
  });

  it("stores a valid subscription", async () => {
    const res = await post({ endpoint: "https://p/1", keys: { p256dh: "a", auth: "b" } });
    expect(res.status).toBe(200);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(1);
  });

  it("400s a malformed subscription", async () => {
    expect((await post({ endpoint: "https://p/1" })).status).toBe(400);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(0);
  });
});
```

- [ ] **Step 10: Hook the notification into ingest**

In `worker/sync/ingest.ts`, after the broadcast on upsert:

```ts
  await broadcast(env, { type: "activity.upsert", activity: row });
  await notifyActivity(env, row).catch((err) => console.error("notify failed", err));
```

- [ ] **Step 11: Write `src/components/EnableNotifications.tsx`**

```tsx
import { useState } from "react";

export function EnableNotifications({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<"idle" | "done" | "denied" | "unsupported">(
    "Notification" in window && "serviceWorker" in navigator ? "idle" : "unsupported",
  );

  async function enable() {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState("denied");

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: vapidPublicKey,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sub.toJSON()),
    });
    setState("done");
  }

  if (state === "unsupported") return null;
  if (state === "done") return <p className="text-xs text-muted">Notifications on.</p>;
  if (state === "denied") {
    return <p className="text-xs text-muted">Notifications blocked in browser settings.</p>;
  }

  return (
    <button
      onClick={() => void enable()}
      className="rounded-[10px] border border-dashed border-line px-4 py-2 text-xs font-semibold text-muted hover:border-muted"
    >
      Notify me when an activity lands
    </button>
  );
}
```

Render it on the Today screen. **On iOS, push only works once the PWA is
installed to the home screen** — add that as helper text under the button
rather than letting it silently fail.

- [ ] **Step 12: Run the Worker suite**

Run: `pnpm exec vitest run --project worker`
Expected: PASS, including the 6 new push tests.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add Web Push notification on activity arrival"
```

---

### Task 12: Playwright end-to-end

**Files:**
- Create: `e2e/dashboard.spec.ts`, `e2e/live.spec.ts`
- Modify: `playwright.config.ts`, `package.json`

**Interfaces:**
- Consumes: the running app.
- Produces: `pnpm test:e2e`.

- [ ] **Step 1: Configure Playwright**

`playwright.config.ts`:

```ts
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://localhost:5173", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 2: Write `e2e/dashboard.spec.ts`**

```ts
import { test, expect } from "@playwright/test";

test.describe("dashboard", () => {
  test("redirects an unauthenticated visitor toward connecting", async ({ page }) => {
    await page.goto("/");
    // With no session the API 401s; the shell must still render, not white-screen.
    await expect(page.getByText("Trainingdash")).toBeVisible();
  });

  test("navigates between screens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Activities" }).click();
    await expect(page).toHaveURL(/\/activities$/);
    await page.getByRole("link", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);
  });
});
```

- [ ] **Step 3: Write `e2e/live.spec.ts`**

This is the test that proves the product claim: an upload appears without a refresh.

```ts
import { test, expect } from "@playwright/test";

test("an incoming webhook event updates the page without a reload", async ({ page, request }) => {
  await page.goto("/");

  const reloaded = page.evaluate(() => {
    (window as unknown as { __stayed: boolean }).__stayed = true;
  });
  await reloaded;

  // The dev Worker's /webhook is reachable on the same origin.
  await request.post("/webhook", {
    data: {
      object_type: "activity",
      object_id: 999_999_999,
      aspect_type: "create",
      owner_id: Number(process.env.E2E_ATHLETE_ID ?? 0),
      subscription_id: 1,
      event_time: Math.floor(Date.now() / 1000),
      updates: {},
    },
  });

  // The page must not have navigated — the update arrives over the socket.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed))
    .toBe(true);
});
```

This spec requires a connected athlete and a real activity id. Set
`E2E_ATHLETE_ID` and swap `object_id` for one of your own activity ids before
running it; it is skipped in CI until those exist.

- [ ] **Step 4: Add the script**

```json
"test:e2e": "playwright test"
```

- [ ] **Step 5: Run it**

Run: `pnpm exec playwright install chromium && pnpm test:e2e`
Expected: the dashboard spec passes. The live spec passes once an athlete is connected.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "test: add Playwright end-to-end specs"
```

---

## Spec coverage

| Spec section | Where |
|---|---|
| §4.5 Notification | Task 11 |
| §5 `push_subscriptions` | Task 11, `migrations/0002_push.sql` |
| §5 Where aggregation runs | Task 2 (`shared/aggregate.ts`), consumed by Tasks 5, 7, 8 |
| §6 `POST /api/push/subscribe` | Task 11 |
| §7 Frontend layout | Tasks 1, 3–9 |
| §7 `useEChart`, no `echarts-for-react` | Task 6 |
| §7 MapLibre tile source | Task 9, Step 5 — an explicit decision point, not an assumption |
| §7 `useLiveUpdates` owns the socket | Task 4 |
| §8 WebSocket drops | Task 4 — backoff reconnect plus refetch on open and on visibility |
| §9 `shared/aggregate.ts` tests | Task 2 — 16 assertions, the densest file in the project |
| §9 Playwright | Task 12 |
| §10 VAPID secrets | Task 11, Step 6 |
| §4.6 Coach | **Plan 3** |
| §11 `README.md` rewrite | **Plan 3**, final task |

## Manual verification

1. `pnpm dev`, connect via Strava, wait for the backfill.
2. Today shows a streak and this week's totals that match Strava's own numbers.
3. Activities → Calendar renders a year grid with your active days filled.
4. Open an activity with a route; the line renders over dark tiles.
5. `pnpm build && pnpm exec vite preview`; install the PWA and confirm it opens standalone.
6. With a tab open, upload to Strava: the list updates with no refresh, and a notification arrives if enabled.

## Definition of done

- `pnpm test` green across both the worker and browser projects; `pnpm typecheck` clean.
- Every screen renders correctly after a hard refresh with the WebSocket blocked — the socket is an optimisation, and this proves it.
- Percentages in the workout mix total exactly 100 for any input.
- The installed PWA opens standalone and its shell loads offline.
