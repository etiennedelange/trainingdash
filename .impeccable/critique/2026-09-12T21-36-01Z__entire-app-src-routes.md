---
target: entire app (src/routes)
total_score: 25
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 2
target_identity: "file:/workspaces/stravadash/entire app (src/routes)"
timestamp: 2026-09-12T21-36-01Z
slug: entire-app-src-routes
---
Method: dual-agent (A: general-purpose design review · B: general-purpose detector/browser evidence)

Note on Assessment B: the deterministic detector ran clean (exit 0, zero findings), but live browser inspection failed in both isolated sessions — three concurrent `chrome-devtools-mcp` processes were already contending for the same Chrome target (`Protocol error: Target closed`, repeated across 4 attempts). Assessment A also had no browser access this run. Both assessments are therefore grounded in a full source read rather than live screenshots; static analysis substitutes for the visual pass.

# Design Critique: Trainingdash — "The Training Terminal"

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `useLiveUpdates` computes `connected` but no component renders it |
| 2 | Match System / Real World | 3 | Sport names/units map straight to Strava; no friction |
| 3 | User Control and Freedom | 2 | Coach has no stop/cancel mid-stream |
| 4 | Consistency and Standards | 3 | Arrival badge uses `rounded-full`, violating DESIGN.md's closed pill rule |
| 5 | Error Prevention | 3 | Coach's Ask button correctly disables on empty draft |
| 6 | Recognition Rather Than Recall | 4 | Nav/tab/caption labels are all self-explanatory |
| 7 | Flexibility and Efficiency | 1 | No search/filter, no adjustable Progress window, zero keyboard shortcuts |
| 8 | Aesthetic and Minimalist Design | 3 | Uncluttered, but near-invisible signal color reads as empty, not restrained |
| 9 | Error Recovery | 4 | `DataError` distinguishes 401 vs. real fetch failure with distinct fixes |
| 10 | Help and Documentation | n/a | Personal single-athlete tool; no help system called for |
| **Total** | | **25/36** | **Acceptable (69%)** |

## Design Specificity Verdict

**LLM assessment:** An unrelated SaaS analytics product could ship this app's structure almost unchanged. Every route (`/`, `/activities`, `/progress`) is the identical skeleton: h1 → KPI tile row → list-or-chart card. The token ladder and closed sport palette are real craft, but they're skin on a generic dashboard shape. `/coach` is a stock chat-bubble widget, not a terminal transcript — the clearest sign the metaphor lives in hue/font, never composition.

**Deterministic scan:** `impeccable detect --json src public` ran clean — exit 0, zero findings.

**Visual overlays:** Not available — browser automation failed at the transport level (MCP session contention) in both isolated sessions.

## Overall Impression

Real design discipline (closed token system, a genuinely good error-state component, low cognitive load) but almost none of it shows up as structure. The one feature meant to be the emotional payoff — live arrival — is a 2.5s glow on a list row you might not be looking at. Fixing route-sameness and making arrival unmissable removes most of the "boring" read without touching the palette.

## What's Working

1. Token architecture (`styles.css:1-78`) — theme parity is structural via CSS custom properties, not hand-maintained.
2. `DataError.tsx` — separates "never connected" from a real network failure with distinct fixes.
3. `ActivityRow.tsx` — the one place the instrument idea is structural, not just chromatic.

## Priority Issues

**[P0] Every route is the same template, and the signal color barely appears on the screen you see most**
- Why it matters: index/activities/progress are structurally identical; only 1 of 4 Today StatTiles carries the accent.
- Fix: give one route a genuinely different shape (hero-scale mono readout for streak, not a KPI tile).
- Suggested command: /impeccable bolder

**[P0] The live-arrival "peak" moment is nearly imperceptible and inaccessible**
- Why it matters: `connected` is computed and never rendered; arrival is a 2.5s row glow with no aria-live announcement.
- Fix: persistent shell connection indicator (teal pulse / amber flash) + aria-live announcement.
- Suggested command: /impeccable delight

**[P1] Coach abandons the design system entirely**
- Why it matters: stock chat bubbles, no mono treatment — reads as a bolted-on generic AI widget.
- Fix: restyle as a terminal transcript (monospace prefixes, left-aligned log).
- Suggested command: /impeccable typeset

**[P1] The arrival badge breaks the system's own shape rule**
- Why it matters: `rounded-full` badge violates DESIGN.md's pill rule reserved for tabs/MixBar.
- Fix: swap to --radius-control or a square badge.
- Suggested command: /impeccable polish

**[P2] Loading states are copy-pasted plain text with zero identity**
- Why it matters: identical `<p>Loading…</p>` across 4 routes — a missed identity beat.
- Fix: one `<LoadingState/>` with a mono terminal treatment.
- Suggested command: /impeccable polish

## Persona Red Flags

**Alex (Power User)**: No search/filter, no adjustable Progress window, zero keyboard shortcuts for a daily-use tool.

**Sam (Accessibility-Dependent)**: Live arrival — the app's one reserved-color feature — gives screen readers nothing. Only one focus-visible rule exists overall.

**Casey (Mobile)**: No responsive collapse defined; 220px sidebar hardcoded with no breakpoint.

## Minor Observations

- StatTile's accent prop used only twice app-wide; visual result reads as generic KPI row.
- Chart choices (bar, heatmap) are the two most common dashboard chart types; no gauge/dial motif despite the metaphor inviting one.
- ThemeToggle styled identically to an inactive nav link — disappears rather than reading as a deliberate mode switch.
- EnableNotifications' copy is the one line with real personality — worth extending elsewhere.

## Questions to Consider

- If "one glowing signal color" is the entire premise, why does it appear on only one of four tiles on the daily screen?
- Was Coach designed against the Training Terminal brief, or built to a generic chat model and left unreconciled?
- Should live arrival be the headline interaction rather than a detail on a row you might never see?
