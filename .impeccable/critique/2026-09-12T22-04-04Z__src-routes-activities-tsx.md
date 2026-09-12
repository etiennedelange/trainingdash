---
target: Activities page
total_score: 28
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 0
target_identity: "file:/workspaces/stravadash/src/routes/activities.tsx"
target_fingerprint: "sha256:556038a73c57c11cea6507dd7852500d805c9a74b77d24a57f23b9228010f383"
target_path: /workspaces/stravadash/src/routes/activities.tsx
timestamp: 2026-09-12T22-04-04Z
slug: src-routes-activities-tsx
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence) — third consecutive re-run, verifying round 2's fixes.

Browser visualization unavailable again in both sessions (Chrome DevTools MCP contention). Findings from complete source-level verification.

# Design Critique: Activities Page — Trainingdash (Round 3)

## Fix Verification — all 4 landed fully

1. Run Green hue split (#a3e635) — confirmed ~96 degree hue separation from signal teal (up from ~30), clear of other sport hues. DESIGN.md updated in lockstep.
2. Sticky header seam — -mx-10/px-10 exactly cancels the page's p-10, aligns flush with content column.
3. Empty-state copy — now genuinely distinct from both DataError states: three different treatments where there used to be one.
4. SPORT_LABEL humanization — correctly scoped to just the three camelCase compounds needing it.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Good orientation via sticky headers + arrival badge; no mid-scroll loading affordance |
| 2 | Match System / Real World | 4 (up from 3) | Consistent metaphor throughout |
| 3 | User Control and Freedom | 1 | No sort/filter/search, unchanged for third round |
| 4 | Consistency and Standards | 4 (up from 3) | Sport colors, mono rule, radius tokens now dot-for-dot with DESIGN.md |
| 5 | Error Prevention | 3 | Pace-string zero-distance edge case still open |
| 6 | Recognition Rather Than Recall | 4 | Day grouping continues to do real work |
| 7 | Flexibility and Efficiency | 1 | Still nothing, flagged as urgent for the second round running |
| 8 | Aesthetic and Minimalist Design | 4 (up from 3) | Three rounds of subtractive/corrective fixes, no new clutter |
| 9 | Error Recovery | 4 | Three genuinely distinct states now, strongest heuristic |
| 10 | Help and Documentation | n/a | Single-athlete personal tool |
| **Total** | | **28/36** | **Good (78%, up from 69%, up from 58%)** |

## Overall Impression

Page crossed from Acceptable into Good. Fix discipline across three rounds has been precise — no scope creep, no ad hoc tokens, docs kept in lockstep. But the one open P1 (no sort/filter/search) has been flagged every round as "increasingly urgent" and hasn't moved.

## New Issues Found (Round 3)

[P3] formatDayHeading omits the year
- Why it matters: "Sunday, Sep 7" gives no way to tell which year once scrolled back far enough — exactly the scenario day-grouping exists to serve.
- Fix: include the year once a heading falls outside the current calendar year.
- Suggested command: /impeccable clarify

[P3] The Calendar tab has no empty-state message
- Why it matters: Timeline shows reassuring copy with zero activities, Calendar just renders a near-blank heatmap.
- Fix: mirror the Timeline empty-state copy in the Calendar tab.
- Suggested command: /impeccable onboard

[P3] The sticky-header seam is a fragile, uncommented coupling
- Why it matters: -mx-10/px-10 exactly cancels p-10 today but nothing documents that relationship.
- Fix: a short comment noting the coupling, matching existing codebase practice.
- Suggested command: /impeccable harden

Still open, unchanged: nonsense pace-string on strength workouts (P2, now confirmed also an audible problem for screen readers), tab ARIA wiring (P3), no sort/filter/search (P1).

## Genuine Strengths

1. All three rounds of fixes have been precise, minimal-diff corrections — no invented tokens, closed-palette rule respected under fix pressure.
2. The three-way state separation (empty / needs-auth / generic-error) is now a reusable pattern.
3. Documentation discipline — DESIGN.md updated alongside code changes is unusually rare.

## Persona Red Flags

Priya (reviewing 18 months of history): no year on day headings past a year boundary; no search/filter means scrolling linearly through hundreds of rows.

Screen-reader user auditing a weight-training log: SPORT_LABEL announces correctly, but the full stat line is announced for a zero-distance strength session too — known-open pace-string issue, now confirmed to hit this persona audibly.

## Provocative Questions

- Three rounds have fixed real but small things while sort/filter/search has been re-flagged each time without moving — sizing problem, or review-process escalation failure?
- Is this page's real usage pattern "check today/yesterday" or "review long history"? The year-omission and missing filter matter a lot more under the second pattern.
