---
target: activity detail page
total_score: 22
max_score: 36
na_heuristics: 10
p0_count: 1
p1_count: 2
target_identity: "file:/workspaces/stravadash/src/routes/activity.$id.tsx"
target_fingerprint: "sha256:4914a93d671e7d83642a8b7cde2b1d6fdb9a7ab3ab74f582e1391487a0e3e451"
target_path: /workspaces/stravadash/src/routes/activity.$id.tsx
timestamp: 2026-09-12T21-47-27Z
slug: src-routes-activity-id-tsx
---
**Method: dual-agent (A: design-review · B: detector-browser)**

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Loading state is a bare `<p>Loading…</p>` — no relation to the terminal design language, and no `aria-live` announcement when data arrives. |
| 2 | Match System / Real World | 3 | Distance/duration/pace/HR match a runner's mental model directly. |
| 3 | User Control and Freedom | 3 | Back link works, but hardcoded to `/` regardless of where the user came from (loses `/activities` context). |
| 4 | Consistency and Standards | 2 | Back link, loading text, and empty-map message are all one-off patterns that ignore DESIGN.md's defined components (`button-ghost`, card treatment). |
| 5 | Error Prevention | 3 | Pace/HR division-by-zero and missing-data cases are guarded in `format.ts`. |
| 6 | Recognition Rather Than Recall | 3 | Units are inline on every tile except when heart rate is absent. |
| 7 | Flexibility and Efficiency | 1 | No next/previous activity navigation, no keyboard path, no deep link out to Strava's own record. |
| 8 | Aesthetic and Minimalist Design | 3 | Content itself is spare and correct; dragged down only by the two unstyled transition states. |
| 9 | Error Recovery | 3 | `DataError`'s 401-vs-generic split is a genuine, specific improvement over a flat failure message. |
| 10 | Help and Documentation | n/a | Single-operator personal tool — no help surface expected at this altitude. |
| **Total** | | **22/36** | **Acceptable (61%)** |

## Design Specificity Verdict

**Design review (unanchored):** Partially authored, and the detail page is the weakest surface in the system relative to `/` and `/activities`. The stat grid and route map correctly inherit "training terminal" DNA — card radius, hairline borders, the single teal signal on the route line, mono numeric type. But the page chrome around that content — a bare `<h1>`, a plain `<p>` subtitle, a plain-text `←` back link, an unstyled "Loading…" string, and a raw sentence for the no-route case — is generic React-app boilerplate that would sit unchanged in any CRUD dashboard. The system's own defined components (button-ghost, StatTile treatment, card wrapper) simply aren't reached for in the transition/empty states.

**Deterministic scan:** `impeccable detect --json` ran clean (exit 0, zero findings) against `activity.$id.tsx`, `StatTile.tsx`, `DataError.tsx`, and `RouteMap.tsx`. The detector's rule set doesn't catch what's wrong here — this is a "reaches for the wrong pattern" problem, not a lint-catchable violation, so a clean scan and a real specificity gap coexist without contradiction.

**Visual overlays:** Not available this run. Browser automation (chrome-devtools MCP) failed to connect in both subagents (`Target.setDiscoverTargets: Target closed`) even though the dev server itself answered 200 on port 5173. No live overlay, no screenshots, no console-error capture were possible; this critique rests on source reading against DESIGN.md's token/component spec rather than the rendered page. Treat the P1/P2 layout claims below as high-confidence from code but visually unverified.

## Overall Impression

The page's "hero" content — the stat tiles and the route map — is genuinely on-brand and well-executed. But every seam around that content (arriving, empty, back navigation) drops out of the design system entirely, which is a specific kind of failure for an app whose whole pitch is "instrumentation, not a generic dashboard": the moments a user sees most often (load, and the no-GPS case) are exactly the moments that look like nothing was designed at all. The single biggest opportunity is treating the loading and empty states as first-class terminal UI, not afterthought strings.

## What's Working

- **StatTile grid + RouteMap correctly reuse the system's vocabulary** — card radius, `--shadow-surface`, hairline borders, and the teal route line all land as intended, with the accent color reserved for distance (the "this matters" stat) per the One Signal Rule.
- **`format.ts` guards its edge cases well** — zero-distance pace and missing heart rate both resolve to sane fallbacks (`—`) instead of `NaN`, `Infinity`, or `0 bpm`.
- **`DataError`'s 401-vs-generic split** is a real, specific UX improvement: it tells the athlete *why* nothing loaded (never connected vs. genuine failure) rather than one flat "could not load" message.

## Priority Issues

**[P0] Unstyled loading state**
- **Why it matters:** `activity.$id.tsx:14` renders `<p className="p-10 text-muted">Loading…</p>` with zero card geometry, no mono type, no skeleton shape. On a page whose entire selling point is "near-instant, live-feeling data," the most-seen transient state looks like an unstyled placeholder from a different app.
- **Fix:** Render ghost `StatTile`-shaped skeletons in the same 2×4 grid (pulsing `bg-card`) so the loading state previews the exact layout that's about to populate — no layout shift, and it reads as terminal instrumentation booting up rather than a generic spinner-less blank.
- **Suggested command:** `/impeccable polish`

**[P1] No-route empty state breaks the card pattern**
- **Why it matters:** `activity.$id.tsx:46` — `<p className="mt-8 text-sm text-muted">No route recorded for this activity.</p>` — sits exactly where the `RouteMap`'s bordered, radiused card (`rounded-[var(--radius-card)] border border-line shadow-[...]`, two lines above) would otherwise be. The layout visibly downgrades for activities without GPS, and the message has none of the card treatment every other content block on this page carries.
- **Fix:** Wrap the empty message in the same card shell (card radius, hairline border, `--shadow-surface`) so the page keeps its rhythm regardless of whether a route exists.
- **Suggested command:** `/impeccable polish`

**[P1] Unbounded activity name can break Display typography**
- **Why it matters:** `activity.$id.tsx:25` renders `data.name` at Display size (27px, one-line role per DESIGN.md) with no truncation. Strava activity names are athlete-authored free text and routinely run long ("Zwift - Group Ride: ... [FLAT] Restart if kicked ..."); unbounded, this wraps to 3+ lines above the fold, especially on narrow viewports.
- **Fix:** `line-clamp-2` (or similar) with a `title` attribute holding the full name, or step down font size past a length threshold.
- **Suggested command:** `/impeccable harden`

**[P2] Back link doesn't match any documented component**
- **Why it matters:** `activity.$id.tsx:21` — `text-xs font-bold text-muted hover:text-text` — isn't `button-ghost`, isn't a nav item, and uses a color-only hover fade where DESIGN.md explicitly calls for a background-step hover ("state changes read as a deliberate switch flip"), not a fade. It's a fifth, undocumented interactive pattern.
- **Fix:** Restyle as a control-radius ghost chip with the documented raised-panel hover step, or fold it into an existing nav-item variant.
- **Suggested command:** `/impeccable layout`

**[P3] Missing heart rate loses unit grammar**
- **Why it matters:** `activity.$id.tsx:36-38` shows a bare em-dash with no unit when `average_heartrate` is absent, while every other populated tile always shows its unit — a small inconsistency in how "no data" is represented across otherwise-identical tiles.
- **Fix:** Keep `unit="bpm"` present (grayed/dimmed) even when the value is "—", so the tile's shape doesn't change based on data presence.
- **Suggested command:** `/impeccable polish`

## Persona Red Flags

**Alex (Power User):** No next/previous-activity navigation from the detail view — every lookup means going back to the list and re-finding the row. The back link is hardcoded to `/` ("Back to Today") rather than the referring list, so arriving from `/activities` silently drops any scroll position or filter state. No keyboard path, no deep link out to the original Strava activity.

**Sam (Accessibility-Dependent User):** No `aria-live` region on the loading→loaded transition, so a screen-reader user gets no announcement that stat values populated. `RouteMap`'s canvas has no textual/tabular fallback of the route for a non-visual user even when a route genuinely exists — only the "no route" failure branch has a text equivalent, which is backwards: the success case is the one silently inaccessible.

## Minor Observations

- `DataError`'s generic `subject` prop produces "Connect your Strava account to see your that activity." at `activity.$id.tsx:15` (`subject="that activity"` fed into "...to see your {subject}.") — grammatically awkward; either change the call site to `subject="this activity"` or restructure the copy template to not double up "your"/"that."
- The activity subtitle (`{data.local_date} · {data.sport_type}`) correctly reuses the `·` separator from `ActivityRow`, which is a good, quiet consistency win worth keeping as a pattern.
- Very short/GPS-noise activities (e.g., 2m) silently zero out pace via the same `distance > 0` guard that correctly handles the true zero-distance case — not wrong, but worth a look if it ever produces a misleading "0:00/km" rather than "—" for edge-case data.

## Questions to Consider

1. If loading and the no-route state are the two most-frequently-seen non-happy-paths on this route, why do they get zero design-system treatment while the happy path gets full card/mono/radius treatment?
2. Should activity detail surface any of the progress/streak signal that's core to this product's pitch, or is this page intentionally scoped as pure telemetry with zero gamification bleed-through?
3. What would "next/previous activity" navigation look like here — arrow keys, swipe, or a persistent strip — given this is a single-athlete, daily-use tool?
