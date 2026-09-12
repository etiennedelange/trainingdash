---
target: Activities page
total_score: 25
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 0
target_identity: "file:/workspaces/stravadash/src/routes/activities.tsx"
target_fingerprint: "sha256:487c68d7d0141266809225daeaaac1e9de706b2515e202beac47419791ea6903"
target_path: /workspaces/stravadash/src/routes/activities.tsx
timestamp: 2026-09-12T21-45-23Z
slug: src-routes-activities-tsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence) — re-run, verifying prior fixes.

Browser visualization unavailable in both sessions (Chrome DevTools MCP profile-lock contention). Findings from complete source-level re-verification.

# Design Critique: Activities Page — Trainingdash (Re-run)

## Fix Verification

1. Day-grouped Timeline with sticky headers — landed, one loose thread: sticky header pins to main's raw edge while the rest of the page uses p-10 padding rhythm.
2. sr-only sport-type label — landed correctly; reads raw API enum (WeightTraining, VirtualRide) rather than a humanized label.
3. --color-run split from --color-accent — landed; light mode unambiguous, dark mode under-distanced (~30 degrees hue apart, similar lightness/chroma, same background).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Day headers add ambient time-sense; still no connection indicator |
| 2 | Match System / Real World | 3 (up from 2) | Today/Yesterday is a strong win; sport still color-only for sighted users |
| 3 | User Control and Freedom | 1 | No sort/filter/search |
| 4 | Consistency and Standards | 3 (up from 2) | Run/accent no longer identical, still hue-close in dark mode |
| 5 | Error Prevention | 3 | Unchanged |
| 6 | Recognition Rather Than Recall | 4 (up from 2) | Day headers eliminate the recall burden |
| 7 | Flexibility and Efficiency | 1 | Unchanged, now more noticeable given grouping |
| 8 | Aesthetic and Minimalist Design | 3 | Sticky-header seam and undersold empty state |
| 9 | Error Recovery | 4 | Unchanged, standout |
| 10 | Help and Documentation | n/a | Single-athlete personal tool |
| **Total** | | **25/36** | **Acceptable, trending Good (69%, up from 58%)** |

## Design Specificity Verdict

Genuine intent still shows (documented groupByDay contract, complete a11y fix, surgical changes). Two of three fixes have a modest gap: sticky header vs. page rhythm, and Run color vs. perceptual distance from accent specifically.

Deterministic scan: clean, exit 0, zero findings across all 8 scoped files.

Visual overlays: not available, same MCP contention as prior runs.

## What's Working

1. groupByDay's "never sorts, only chunks" contract is well-reasoned and documented.
2. The sr-only fix is genuinely complete, not a token gesture.
3. DataError's 401-vs-generic distinction remains a standout.

## New Priority Issues (this round)

[P2] Run Green sits too close in hue to the signal accent in dark mode
- Why it matters: #4ade80 vs #2dd4bf, ~30 degrees hue apart, similar lightness/chroma, same background — can still register as "the signal color."
- Fix: pull Run further toward true green/yellow-green; light mode already shows the right instinct.
- Suggested command: /impeccable colorize

[P3] Sticky day header meets the scroll container's raw edge, not the page's padding rhythm
- Why it matters: pins flush to main's edge while the rest of the page uses 40px padding.
- Fix: add a top offset or padded sticky wrapper.
- Suggested command: /impeccable layout

[P3] Empty state ("No activities yet.") is typographically identical to an error state, no next step
- Why it matters: same treatment as DataError's copy — reads as broken, not "you haven't started."
- Fix: distinguish visually from DataError; consider a next-step nudge.
- Suggested command: /impeccable onboard

[P3] sr-only label reads the raw API enum, not a humanized sport name
- Why it matters: "WeightTraining activity" announces as one unspaced word-run.
- Fix: map through a small humanization table.
- Suggested command: /impeccable clarify

Still open, not re-flagged: nonsense pace string on strength workouts (P2), tab ARIA wiring (P3), no sort/filter/search (P1, now more visible given grouping).

## Persona Red Flags

Jordan (First-Timer): hits "No activities yet." with nothing to do next.

Sam (Accessibility-Dependent): day h2 fix is correct but has no ARIA relationship to the rows beneath it.

Riley (Stress Tester): groupByDay recomputes every render with no memoization; paired with WebSocket refetches, a burst of live inserts mid-scroll could reflow day-group boundaries during a sticky transition — worth live-testing, not confirmed broken.

## Minor Observations

- Calendar heatmap colors by density using the signal-accent gradient, not sport colors — likely intentional, worth confirming.
- Ride Violet and Walk Blue remain close in hue to each other in both themes — pre-existing, unrelated to this round.

## Questions to Consider

- Was the new Run Green value checked against the accent specifically, or only against "is it different than before"?
- Does the absence of a date-range filter feel like a sharper gap now that the Timeline has real temporal structure?
