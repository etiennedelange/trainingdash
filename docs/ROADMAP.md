# Roadmap

Where the product stands against its two pillars (see `PRODUCT.md`), what
shipped, and what is next.

## Pillar 1 — the live result screen

An activity lands → the app shows "here's what it means", instantly.

**Shipped:**
- **App-wide arrival hero** (`ArrivalResult` in the root layout) renders from
  the socket payload the instant an `activity.upsert` fires — before the
  cache refetch — on whatever page the athlete is on, and stays until
  dismissed.
- **Frame** under the telemetry: this-week distance + count, ▲/▼ vs last
  week, the running streak, a "Best week yet" tag, and a "New record · …" tag
  for every personal record the arrival just set.
- **Weekly distance goal** (localStorage) with a progress bar in the hero,
  plus a goal setter and a goal line on the Progress chart. Caveat: the goal
  is per-browser; a server-side setting would be needed to sync across
  devices.

## Pillar 2 — "am I doing too much or too little?"

**Shipped:**
- **Acute:chronic load band** (`LoadBand`) — 7-day ÷ 28-day *mean* daily
  moving time, gated on ≥7 active days in the 28-day window, drawn as a
  marker on a detraining / steady / spiking band. On Today and Progress.
- **Personal records** board on Progress (longest run, fastest run pace for
  efforts ≥1 km, most climbing, best week).
- **Backfill progress** on Today while the first-run import runs (polls the
  activities query every 4s so the count grows live).

## Also shipped

- **Search** + date-range filter on the Activities timeline (name, sport,
  From/To dates — all combinable).
- **Cmd+K command palette** (pages + activities, keyboard-navigable).
- **Coach bring-your-own-key** — paste an Anthropic key in-app, stored
  encrypted in D1; the env-var key becomes optional.

## Next

Priority order:

1. **Offline data** — persist the activities query to IndexedDB so the PWA
   shell opens instantly and shows history with no network. Today the shell
   installs but the data dies once a refetch fails.
2. **Progress depth** — month-by-month and year-over-year distance charts;
   Progress currently only spans the last 8 weeks.
3. **Dependabot alert** — GitHub flags a high-severity advisory on the
   default branch (`security/dependabot/18`). Investigate before stacking
   more.
4. **Activity detail** — elevation profile (needs a streams fetch) and
   surfacing `achievement_count` / kudos from the stored `raw`.
5. **Calendar heatmap click-through** — click a day to jump to it in the
   timeline.
6. **Rest-day awareness** — "days since rest" alongside the streak.
7. **Coach on the surface** — a one-line "Coach's take" on Today after
   arrivals (opt-in; it costs an API call per answer).

## Constraints that stay load-bearing

- Single athlete; gated by `ALLOWED_ATHLETE_ID`.
- Honest, derived stats only — no invented badges or leaderboards
  (`PRODUCT.md`).
- Every component reads the design tokens in `src/styles.css`; no new
  hardcoded colors/radii (`DESIGN.md`).
- Aggregation is pure and lives in `shared/aggregate.ts`; the WebSocket is an
  optimisation, never the source of truth.