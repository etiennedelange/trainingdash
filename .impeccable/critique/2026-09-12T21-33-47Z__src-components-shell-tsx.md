---
target: left hand menu (src/components/Shell.tsx)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
target_identity: "file:/workspaces/stravadash/src/components/Shell.tsx"
target_fingerprint: "sha256:453e6174cd4f0a6d4b6c7e41feb60ecd171248fc87cdc320354f4451f06428d3"
target_path: /workspaces/stravadash/src/components/Shell.tsx
timestamp: 2026-09-12T21-33-47Z
slug: src-components-shell-tsx
---
Method: dual-agent (A: general-purpose · B: general-purpose)

Note on evidence: Assessment A chose a code-only review (did not load/use browser tooling, citing time-box) rather than live-inspecting the page. Assessment B's browser automation layer failed at the protocol level (`Target.setDiscoverTargets: Target closed`, on two separate attempts) despite the dev server itself being reachable (curl 200 on `/` and `/detect.js`); its CLI detector pass ran cleanly, but no screenshots, console injection, or theme-toggle visuals were captured by either assessment. Everything below marked as visual/responsive behavior is a code-level inference (from Tailwind classes and component structure), not a confirmed live observation — flagged inline where it matters.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Active state (`bg-raised text-text`) and every other item's hover state (`hover:bg-raised`) render identically — hovering a non-active item can visually read as "you are here." |
| 2 | Match System / Real World | 3 | Today/Activities/Progress/Coach map cleanly to an athlete's mental model; no jargon. |
| 3 | User Control and Freedom | 3 | Standard client-routed links, native back/forward; logout is low-stakes and reversible by reconnecting. |
| 4 | Consistency and Standards | 3 | Nav/tab/account-action states share one visual language per DESIGN.md; loses a point to the active/hover collision above. |
| 5 | Error Prevention | 2 | `Connect Strava` is a plain `<a href>` (full page reload) styled identically to the client-routed nav items — no cue that it behaves differently and will drop SPA/query-cache state. |
| 6 | Recognition Rather Than Recall | 3 | Persistent, always-visible 4-item list; no memory burden. |
| 7 | Flexibility and Efficiency of Use | 0 | Zero accelerators: no keyboard shortcuts, no collapse, no pin/reorder, nothing that rewards a daily power user over a first-time visitor. |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, no clutter, zero detector findings; consistent with the system's "quiet by default" ethos. |
| 9 | Error Recovery | 2 | A genuine `/api/me` network error and the loading state both resolve to `AccountStatus` returning `null` — a broken-auth user gets a silently empty footer with no explanation. |
| 10 | Help and Documentation | 0 | No help affordance anywhere in the nav — nothing hints what "Coach" does before a user commits to clicking it. |
| **Total** | | **21/40** | **Acceptable — functional and internally consistent, but several real gaps** |

This is an Operate-mode surface (persistent app nav), so heuristics 7 and 10 were scored for real rather than auto-exempted — and both landed at the floor, which is the single biggest drag on the total.

## Design Specificity Verdict

**LLM assessment:** Read cold, the sidebar is the skeleton of any SaaS admin template — a 220px fixed rail, four flat text links, a gradient-square logo, a footer toggle + auth button. Nothing in the nav markup itself carries the "Training Terminal" signature: no mono type anywhere in it (DESIGN.md's own "All-Numbers-Are-Mono" rule has nothing to grab onto here, since a nav has no numbers), no Signal Teal at rest (correct per the One Signal Rule, but the net effect is the nav is the one surface in the whole system with zero use of the system's own signal color). The one authored touch is the logo glyph — a custom pace-bolt path on a teal-to-teal-deep gradient tile. Cross-checking DESIGN.md confirms this is acknowledged rather than accidental ("No animated indicator — state is purely a background swap"), but the doc's own ambition ("almost all of its personality lives in four things") is far more legible in `ActivityRow` or the stat tiles than here. Verdict: competently reskinned generic nav chrome, not a nav designed outward from the terminal concept — and the one place the system's reserved Arrival Amber/Gold pair could finally earn its keep (a live-arrival cue on the nav item for the page an activity landed on) sits completely unused, even though the webhook/WebSocket pipeline that would trigger it already exists (`useLiveUpdates`).

**Deterministic scan:** `impeccable detect --json` against `Shell.tsx`, `__root.tsx`, `AccountStatus.tsx`, and `ThemeToggle.tsx` returned exit code 0 and an empty findings array — zero anti-patterns detected, confirmed against `.impeccable/config.json` (no ignore rules suppressing these files). No false positives to adjudicate, because there were no findings. This is a clean read, not a null result — the sidebar has no scannable hex-hardcoding, no ad-hoc radius, no rule violations at the token level.

**Visual overlays:** Not available this run. Browser automation failed at the protocol layer on repeated attempts (`Target.setDiscoverTargets: Target closed`), so no script injection occurred and no user-visible `[Human]`-tab overlay exists. Treat the responsive/mobile and active-vs-hover-contrast findings below as code-level inference until confirmed visually.

## Overall Impression

The sidebar is disciplined and token-correct — it will never look broken, and it inherits dark/light mode for free exactly as the system promises. But it's the least "instrumented" surface in an instrumentation-themed app: no mono type, no signal color at rest, no live-arrival signal despite the plumbing existing for one, and zero accelerators for the one person who'll open it dozens of times a day. The single biggest opportunity is turning the nav into the place where the app's headline feature (near-instant live arrival) is *felt*, not just delivered elsewhere on the page.

## What's Working

1. **Token discipline is real, not aspirational.** Every color/radius in `Shell.tsx` is a CSS variable or Tailwind theme value — no hardcoded hex, no ad-hoc radius — confirmed by both the code review and a clean detector pass. The nav will re-skin correctly for light mode with zero component branching.
2. **`aria-current="page"` is wired to actual route state**, not a locally-clicked index, so it stays correct across deep links and back/forward navigation — not a common thing to get right by accident.
3. **A real, consistent focus-visible ring** across all nav links and footer buttons (2px outline, offset, mouse-click suppressed) — a genuinely solid accessibility baseline most teams skip.

## Priority Issues

**[P1] No responsive/mobile behavior for a PWA-installable app**
- **Why it matters**: The app ships `vite-plugin-pwa` with an install manifest, meaning it's meant to be installed on a phone — yet the sidebar is a hardcoded `w-[220px]` with (per DESIGN.md's own words) "no responsive collapse defined." On a ~375px install, the nav would permanently consume over half the viewport. This is a plausible blocker for the stated install use case, not hypothetical polish — though unconfirmed visually this run since browser automation failed.
- **Fix**: Add a collapse/overlay pattern below a breakpoint (icon rail or slide-over drawer), consistent with the system's existing background-ladder language rather than a new visual idiom.
- **Suggested command**: `/impeccable adapt`

**[P1] Active state is visually identical to hover state on other items**
- **Why it matters**: `Shell.tsx`'s active item renders `bg-raised text-text`; every inactive item's hover is `hover:bg-raised` — the same background token, no text-color shift. Hovering "Activities" while "Today" is the active route makes "Activities" momentarily read as current. This directly undermines "where am I" wayfinding on the app's single persistent nav element.
- **Fix**: Differentiate active from hover — e.g. keep `text-text` exclusive to the true active item, or add a small persistent marker (left rule, dot, or the reserved teal) that hover alone never triggers.
- **Suggested command**: `/impeccable layout`

**[P2] "Connect Strava" silently breaks the SPA contract**
- **Why it matters**: `AccountStatus.tsx` renders a plain `<a href="/auth/login">` styled identically to the client-routed nav items, causing a full page reload with no visual cue (no external-link marker, no distinct affordance) that this control behaves differently from everything else in the sidebar. A user with an expired session hits an unexpected flash/reload.
- **Fix**: Either route this through the client router with an explicit redirect step, or give it a distinct visual treatment signaling "this leaves the app shell."
- **Suggested command**: `/impeccable clarify`

**[P2] Nav has no overflow escape hatch on short viewports**
- **Why it matters**: `<nav>` has no `overflow-y-auto` (unlike `<main>`, which does), and the footer is pinned via `mt-auto`. On a short or split-screen viewport, logo + 4 items + 2-row footer can exceed available height with items or footer silently clipped rather than scrolling into view.
- **Fix**: Add `overflow-y-auto` to the nav column, or otherwise guarantee the footer's controls stay reachable at minimum viewport heights.
- **Suggested command**: `/impeccable adapt`

**[P3] "Coach" isn't visually differentiated as a different interaction mode**
- **Why it matters**: Styled identically to three read-only dashboard views even though it presumably opens a conversational AI surface — no icon, badge, or subtext hints that clicking it changes the interaction paradigm, hurting discoverability of what's likely the most novel feature in the app.
- **Fix**: A small visual tell (icon, "beta"/"AI" tag, or distinct hover treatment) that signals a mode switch before commitment.
- **Suggested command**: `/impeccable delight`

## Persona Red Flags

**Alex (Power User)**: Zero efficiency accelerators — no keyboard shortcuts to jump between routes, no way to collapse the sidebar to reclaim width on a laptop, no live/streak badge glanceable without a click. After weeks of daily use, the nav offers Alex nothing beyond a first-time visitor's experience (heuristic 7 scored 0 for exactly this reason). The `Connect Strava` full-reload behavior (P2 above) will also visibly cost Alex time and in-flight state on any session where the cookie silently expired.

**Sam (Accessibility-Dependent User)**: The wins are real — consistent `:focus-visible` and correctly-wired `aria-current`. The gaps: nav items are bare `<Link>` siblings with no `<ul>/<li>` structure and the `<nav>` has no `aria-label`, so a screen reader announces "navigation, 4 links" with no position cue ("2 of 4") a proper list would give — a missed easy win. More concretely, a genuine `/api/me` fetch error and the loading state both resolve to `AccountStatus` returning `null` — Sam gets total silence in the footer with no text a screen reader could ever announce, and no path to understanding why the connect/logout control simply isn't there (heuristic 9).

## Minor Observations

- The logo mark + "Trainingdash" wordmark isn't itself a link to `/` — most sidebar conventions make the logo double as a home link; here it's inert.
- The `NAV` array order (Today, Activities, Progress, Coach) is sensible IA, but DESIGN.md doesn't record why, worth a one-line rationale if it's ever revisited.
- The active state's background delta (Deep Panel sidebar vs. Raised Panel active item) is a fairly subtle contrast step in the token values alone — worth a visual contrast spot-check once browser automation is working again, rather than assuming the ladder reads clearly at a glance.

## Questions to Consider

- If Signal Teal is reserved for "the thing that actually matters," and the active nav item deliberately avoids it per the One Signal Rule — is a plain background swap really enough wayfinding for the app's single most-clicked interaction, or does the system's own purity rule quietly under-serve it?
- The app ships as an installable PWA, yet the sidebar has explicitly "no responsive collapse defined yet" — was that a deliberate desktop-only scoping call, or a gap nobody has hit yet?
- Arrival Amber/Gold is reserved specifically for the live-arrival moment, and the webhook/WebSocket pipeline already exists — why does the nav, the one element visible no matter what page you're on, currently surface none of that moment?
