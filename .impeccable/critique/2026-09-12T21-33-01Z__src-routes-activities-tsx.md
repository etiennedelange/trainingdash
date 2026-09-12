---
target: Activities page
total_score: 21
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 1
target_identity: "file:/workspaces/stravadash/src/routes/activities.tsx"
target_fingerprint: "sha256:57e7bae16ef05cd3e9c0d984e643fcb1e5ed46db678471914010501bb9a3d933"
target_path: /workspaces/stravadash/src/routes/activities.tsx
timestamp: 2026-09-12T21-33-01Z
slug: src-routes-activities-tsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

Note: browser visualization failed in both sessions due to Chrome DevTools MCP profile-lock contention. Assessment A's findings are built from a complete line-level source read, with anything requiring live rendering explicitly flagged as unconfirmed.

# Design Critique: Activities Page — Trainingdash

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live-arrival glow/badge works; no connection indicator surfaced on this route |
| 2 | Match System / Real World | 2 | Sport type conveyed by color dot alone, no text |
| 3 | User Control and Freedom | 1 | No sort, filter, search, or date-range jump |
| 4 | Consistency and Standards | 2 | Run's sport color is identical to the app's one signal accent (documented intentional per DESIGN.md, see note) |
| 5 | Error Prevention | 3 | Read-only surface, low error surface area (n/a-leaning) |
| 6 | Recognition Rather Than Recall | 2 | No date rendered on any row |
| 7 | Flexibility and Efficiency | 1 | No shortcuts, bulk actions, or density control |
| 8 | Aesthetic and Minimalist Design | 3 | Rows are minimal; loses a point for nonsense pace string on non-distance sports |
| 9 | Error Recovery | 4 | DataError's 401-vs-generic split with co-located fix — standout heuristic |
| 10 | Help and Documentation | n/a | Single-athlete personal tool |
| **Total** | | **21/36** | **Acceptable** |

## Design Specificity Verdict

LLM assessment: Could be almost any activity-tracking list — the Timeline shows no date despite ActivitySummary carrying start_date/local_date on every record. A screen subtitled "History, calendar and streaks" that can't answer "when did this happen" isn't authored as a timeline. The Calendar tab is the one place the terminal identity lands, but it's the non-default tab. Verdict: generic activity list dressed in the terminal's tokens.

Deterministic scan: impeccable detect across activities.tsx, ActivityRow.tsx, StatTile.tsx, ActivityCalendar.tsx, DataError.tsx, styles.css — exit 0, zero findings.

Visual overlays: Not available — Chrome DevTools MCP profile-lock contention in both sessions.

## Overall Impression

Token architecture holds up well as more surfaces get built on it; the recent error-state fix is a genuine improvement. But the page's content — a flat, undated, unchunked list — doesn't deliver on "training terminal" or its own stated job. Biggest opportunity: dates and temporal grouping in the Timeline.

## What's Working

1. DataError's 401-vs-generic split is a real UX fix — tailored copy, co-located remedy.
2. Flat-by-default token discipline is real and consistently applied.
3. The radius ladder is load-bearing — maps exactly onto the components using it, and light mode scales the whole ladder rather than re-skinning colors.

## Priority Issues

[P0] Timeline rows carry no date, despite the data existing on every record
- Why it matters: ActivitySummary has start_date/local_date; ActivityRow never renders either.
- Fix: Render a compact mono date/relative-date token per row, group under sticky day/week headers.
- Suggested command: /impeccable clarify

[P0] Sport type is conveyed by color alone, hidden from assistive tech
- Why it matters: Sport dot is aria-hidden with no adjacent label — screen reader users get zero sport-type signal.
- Fix: Add a visually-hidden (sr-only) text label stating the sport type.
- Suggested command: /impeccable audit

[P1] No chunking for a page meant to hold hundreds of activities
- Why it matters: Full unpaginated array renders as one flat stack — cognitive-load failure and performance concern.
- Fix: Group by month/week with sticky headers; consider virtualization past a few hundred rows.
- Suggested command: /impeccable layout

[P2] The pace/stat string is meaningless for non-distance sports
- Why it matters: Every row renders distance/duration/pace regardless of sport — WeightTraining shows "0.00 km · 32:00 · —/km".
- Fix: Branch the stat string per sport family.
- Suggested command: /impeccable clarify

[P3] Tabs are missing ARIA wiring their own roles imply
- Why it matters: role="tab" exists but no aria-controls/tabpanel link, no arrow-key nav.
- Fix: Add id/aria-controls/aria-labelledby pairs and arrow-key handling.
- Suggested command: /impeccable audit

Note: Run's sport color being identical to --color-accent is documented as intentional in DESIGN.md ("running is treated as the home sport"), not drift — downgraded from a priority issue to a question for the user.

## Persona Red Flags

Alex (Power User): No date column blocks correlating training patterns without opening each row. No sort/filter. StatTiles show only lifetime counts, no week-over-week delta.

Riley (Stress Tester): Long names truncate correctly but no title attribute for full name on hover. Zero activities has no empty-state branch — reads as broken. Hundreds of activities is the actual failure mode of the flat list.

## Minor Observations

- Loading state is a bare "Loading…" paragraph with no skeleton — page visibly pops into shape.
- Calendar heatmap caps intensity at 3 activities/day.
- Active nav item distinguished only by background-lightness shift, never accent color.

## Questions to Consider

- If "the terminal" is the whole identity, why does its most-visited history view carry zero temporal information?
- Was making Run's color identical to the signal accent a deliberate statement you still want, now that it means the sport dot and the "this is active" signal look the same?
