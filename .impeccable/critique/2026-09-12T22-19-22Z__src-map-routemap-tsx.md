---
target: map control on activity details page
total_score: 15
max_score: 36
na_heuristics: 10
p0_count: 1
p1_count: 2
target_identity: "file:/workspaces/stravadash/src/map/RouteMap.tsx"
target_fingerprint: "sha256:50f07912f41b9f6458fd2773616ae664e325baba08c0c4dba1f7fb5c44ea795d"
target_path: /workspaces/stravadash/src/map/RouteMap.tsx
timestamp: 2026-09-12T22-19-22Z
slug: src-map-routemap-tsx
closed: true
---
**Method: dual-agent (A: design-review · B: detector-browser)**

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | Tiles load with no loading affordance; tile errors are swallowed by `console.error` (`RouteMap.tsx:59`) and a broken map is indistinguishable from "no route". |
| 2 | Match System / Real World | 2 | Teal line = "the run" is right, but the map never says where it started or ended — it maps to "a shape", not "my Tuesday loop". |
| 3 | User Control and Freedom | 2 | Pan/zoom/pinch work via MapLibre defaults, but there is no zoom, recenter/reset, or fullscreen control; a theme toggle destroys the map and discards the user's viewpoint. |
| 4 | Consistency and Standards | 1 | The only visible control — MapLibre's compact attribution — is a hardcoded white pill with black text and a 12px radius, a second untokened visual language. Confirmed rendered at `rgb(255,255,255)` / `rgb(0,0,0)`. |
| 5 | Error Prevention | 2 | WebGL absence is caught (`RouteMap.tsx:44-57`), but `fitBoundsOptions` has no `maxZoom`, so a short/gappy activity can fit to an unusable street zoom. |
| 6 | Recognition Rather Than Recall | 1 | No markers, labels, or start/finish cues; everything the map means must be recalled from the tiles above. |
| 7 | Flexibility and Efficiency | 2 | MapLibre does provide drag/pinch/keyboard pan-zoom and a grab cursor, but nothing surfaces that, and there are no power affordances (fullscreen, reset, open-in-Strava). |
| 8 | Aesthetic and Minimalist Design | 2 | Token-correct frame and route line, undermined by the white attribution blob and MapLibre's `#0096ff` focus ring. |
| 9 | Error Recovery | 2 | A WebGL fallback and parent no-polyline fallback exist, but neither offers retry; tile-level errors are invisible and unrecoverable. |
| 10 | Help and Documentation | n/a | Single-operator personal tool — no help surface expected at this altitude. |
| **Total** | | **15/36** | **Poor (42%)** |

## Design Specificity Verdict

**Design review (unanchored):** Token-authored, composition-generic. The *treatment* is genuinely this product's: the route line reads `--color-accent` (`RouteMap.tsx:75`), the basemap itself swaps with `useTheme` (`RouteMap.tsx:48`), the frame uses `--radius-card` + `--shadow-surface` (`activity.$id.tsx:51`), and the 3px rounded-join line matches DESIGN.md's route-map spec exactly. None of that is interchangeable.

But the *composition and interaction* are the stock MapLibre "fit bounds + one line + attribution" demo. No start/end markers, no telemetry overlay, no authored controls, no directional or elevation encoding. Swap one hex and the basemap URL and any Strava clone ships this unchanged. There are really two maps stacked here: the intended one (dark tile style, teal route) and an untouched framework overlay (white attribution pill) that the design system never accounted for.

**Deterministic scan:** `impeccable detect --json` ran clean against `src/map/RouteMap.tsx`, `src/routes/activity.$id.tsx`, and the `src/map/` directory — exit 0, zero findings. That clean result is not exoneration: the detector's static rules can't sample a WebGL canvas, and the primary defect (un-tokened framework chrome) lives in MapLibre's injected DOM, not the source. A clean scan and a real specificity gap coexist without contradiction. In-browser live overlay injected successfully and reported 3 anti-patterns — `✦ ai color palette` ×2 (sidebar logo, first `StatTile`) and a global zero-offset glow rule — **none on the map control**, so those are correctly treated as false positives for this target.

**Visual overlays / rendered evidence:** Browser inspection succeeded this run (Playwright + bundled Chromium, since chrome-devtools MCP was not exposed). The map rendered — canvas 978×320, WebGL live, worker assets `/maplibre-gl-worker.mjs` and `/maplibre-gl-shared.mjs` both 200, OpenFreeMap dark style 200, no `map init failed` and no fatal WebGL error. Computed styles confirmed the anomaly: the parent control stack inherits dark-theme ink `rgb(241,244,247)`, but `.maplibregl-ctrl-attrib` overrides to white background / black text. Screenshots at `/tmp/opencode/map-control.png` and `/tmp/opencode/detail-mocked.png` (ephemeral). The light theme was not exercised.

## Overall Impression

The map is the emotional centerpiece of the activity page, and it half-delivers: the dark basemap with a single teal line reads exactly like "the thing the athlete actually did", and it sits correctly in a token-correct card. Then a stock white MapLibre attribution pill, styled in a language no part of this system speaks, lands on top of it. The bigger gap is that the map stops at "a line on tiles" — no start, no finish, no controls, no loading state — so the signature surface can't be interrogated, only glanced at. Making the map feel as authored as the rest of the terminal is the single biggest opportunity, and it doesn't require a redesign: it requires owning the chrome and adding route semantics.

## What's Working

- **Correct semantic use of the one signal color.** The route line is the only accent on the canvas and comes from the live token (`RouteMap.tsx:75`), honoring the One Signal Rule exactly as DESIGN.md specifies for the route.
- **Real theme integration, not a second theme.** The basemap URL is the one justified canvas exception (`RouteMap.tsx:9-12,48`); the map genuinely re-skins on toggle rather than hardcoding dark.
- **Defensive init.** The try/catch around the MapLibre constructor prevents a missing-WebGL environment from taking down the whole route (`RouteMap.tsx:44-57`) — a deliberate, well-commented degradation. The worker-asset fix described in the file comment is also verifiably working (both assets 200 in-browser).

## Priority Issues

**[P0] `role="img"` wraps an interactive, focusable MapLibre canvas**
- **Why it matters:** `activity.$id.tsx:48-51` declares the map container `role="img"`, while MapLibre injects `role="region" aria-label="Map"` and a tabbable keyboard handler *inside* it. Descendants of `role="img"` are treated as presentational, so a screen reader announces an incoherent "Route map for X, image" over a region it can't act on. Keyboard users get a focus target whose focus ring is clipped by the wrapper's `overflow-hidden`, and there is no textual equivalent of the route.
- **Fix:** Pick one intent. If the map is interactive (it is), drop `role="img"`, let the inner map carry the labeled region, ensure `focus-visible` isn't clipped, and add an `sr-only` summary (distance, duration, start/end place names) as the non-visual representation.
- **Suggested command:** `/impeccable harden` (with `/impeccable adapt` for the ARIA/focus pass)

**[P1] MapLibre's default chrome clashes with the design system**
- **Why it matters:** `.maplibregl-ctrl-attrib` is a hardcoded white pill with black links and a `#0096ff` focus ring, confirmed rendered white/black on top of the dark card. It violates the radius ladder, the Flat-by-Default rule, and both themes at once — the only persistent overlay on the signature surface speaks a foreign visual language.
- **Fix:** Add scoped overrides in `src/styles.css` restyling `.maplibregl-ctrl-attrib` / `-button` to `--color-card` / `--color-text` / `--radius-control` with the accent focus ring (or use a custom token-built control). This is a few lines of CSS and is the highest value-per-effort fix in the report.
- **Suggested command:** `/impeccable polish`

**[P1] No controls and no interactivity affordance; fixed 320px height**
- **Why it matters:** Only `attributionControl` is passed (`RouteMap.tsx:51`) — no zoom, recenter/reset, or fullscreen. The map *is* interactive but never says so; there's no way back to the fitted view. On mobile the fixed 320px strip is a thumbnail whose only real tappable target is a sub-44px attribution button, and MapLibre's `touch-action` risks fighting page scroll.
- **Fix:** Add a small token-styled control cluster (zoom, reset-to-fit, fullscreen), make height responsive (`h-[320px] sm:h-[420px]`), and give the map a caption so it reads as an instrument, not decoration.
- **Suggested command:** `/impeccable adapt` (+ `/impeccable polish` for control styling)

**[P2] The map has no authored route semantics**
- **Why it matters:** No start/end markers, no direction, no distance/elevation overlay — the emotional centerpiece says nothing the four stat tiles don't, and it stays category-interchangeable.
- **Fix:** Add a start dot and a distinct end marker, plus an on-map distance label or a light telemetry overlay (per-km cues or pace-colored segments) so the map earns its signature status.
- **Suggested command:** `/impeccable shape` (or `/impeccable craft`)

**[P2] Theme switch tears down and rebuilds the map, losing the viewpoint**
- **Why it matters:** The effect calls `map.remove()` and constructs a new map on every `theme` change (`RouteMap.tsx:79-82`). Any pan/zoom is silently discarded and the iframe flashes, which reads as a glitch during a mode toggle.
- **Fix:** Capture `getCenter/getZoom/getBearing` before teardown and re-apply on the new instance — or swap the style in place and re-add source/layer, re-reading `--color-accent`.
- **Suggested command:** `/impeccable animate` (or `/impeccable polish`)

## Persona Red Flags

**Alex (Power User):** Can't fullscreen, can't reset to fit, and a theme flip blows away his zoomed-in position. Errors are console-only. No hint keys, no deep link out to the Strava activity. He opens Strava instead.

**Sam (Accessibility-Dependent):** `role="img"` over a focusable `role="region"` is contradictory; the canvas has no accessible route description; the focus outline is clipped by `overflow-hidden`; the only real control's focus style is MapLibre's `#0096ff`. The success case (a route that exists) is the one with no text equivalent — only the "no route" branch has one.

**Casey (Mobile):** Fixed 320px map, no controls, no fullscreen, a sub-44px tap target, and a canvas that may swallow vertical page scroll while she's just trying to read the stats.

## Minor Observations

- **Silent tile errors and no loading state (P3):** `map.on("error")` only logs (`RouteMap.tsx:59`), and there's no skeleton while tiles load — despite `styles.css` already shipping a `skeleton-pulse` primitive the rest of the app uses.
- `fitBoundsOptions: { padding: 32 }` is uniform, so the route can slide under the ~34px attribution pill at bottom-right.
- No `maxZoom` guard on `fitBounds`; a tiny or jittery polyline can render at an unhelpful zoom.
- No line casing/halo: 3px terracotta over the light Positron basemap may under-separate from light-gray roads.
- `decodePolyline` has no malformed-input guard, so a truthy-but-invalid `data.polyline` bypasses the "No route recorded" fallback and leaves a blank card.
- The WebGL fallback (`RouteMap.tsx:86-88`) uses `text-muted` while the sibling attribution doesn't, so the two degraded states look unrelated.

## Questions to Consider

1. Is this map a *poster of the run* or an *instrument you interrogate*? That single decision determines the ARIA role, whether controls are mandatory, and whether start/end + telemetry are required — right now the code answers both ways at once.
2. If the One Signal Rule reserves teal for the route, why does the only other colored object on the canvas — the stock white MapLibre attribution — get to speak a second, untokened language?
3. What does the map tell the athlete that the four `StatTile`s don't? If the answer is only "the shape", should it carry telemetry it can uniquely show (pace-colored segments, km markers, elevation)?
