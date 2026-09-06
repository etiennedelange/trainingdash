---
name: Trainingdash
description: A dark, single-athlete training terminal — one signal color against void black, numbers rendered as telemetry.
colors:
  void-black: "#0b0f14"
  deep-panel: "#0e141b"
  terminal-card: "#141b23"
  raised-panel: "#1d2530"
  ghost-line: "rgb(255 255 255 / 0.08)"
  readout-white: "#f1f4f7"
  instrument-gray: "#8792a0"
  dim-gray: "#5b6472"
  signal-teal: "#2dd4bf"
  signal-teal-deep: "#0e9488"
  arrival-amber: "#ff8a5c"
  arrival-gold: "#ffd166"
  run-teal: "#2dd4bf"
  strength-magenta: "#f472b6"
  ride-violet: "#a78bfa"
  walk-blue: "#60a5fa"
typography:
  display:
    fontFamily: "Space Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 700
    lineHeight: 1.2
  body:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.5
  label:
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.04em"
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: 1.1
rounded:
  control: "10px"
  nav: "11px"
  row: "13px"
  tile: "15px"
  card: "18px"
components:
  button-primary:
    backgroundColor: "{colors.signal-teal}"
    textColor: "{colors.void-black}"
    rounded: "{rounded.nav}"
    padding: "10px 12px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.instrument-gray}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
  nav-item-active:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.readout-white}"
    rounded: "{rounded.nav}"
    padding: "10px 12px"
  stat-tile:
    backgroundColor: "{colors.terminal-card}"
    textColor: "{colors.readout-white}"
    typography: "{typography.mono}"
    rounded: "{rounded.tile}"
    padding: "16px"
  activity-row:
    backgroundColor: "{colors.terminal-card}"
    textColor: "{colors.readout-white}"
    rounded: "{rounded.row}"
    padding: "12px 16px"
  tab-active:
    backgroundColor: "{colors.raised-panel}"
    textColor: "{colors.readout-white}"
    rounded: "{rounded.control}"
    padding: "8px 16px"
---

# Design System: Trainingdash

## Overview

**Creative North Star: "The Training Terminal"**

Trainingdash reads as a piece of instrumentation, not a lifestyle app: a near-black surface, one glowing signal color, and every number set in mono type like a raw readout rather than a decorated stat. There is no chrome for chrome's sake — the interface is a sidebar and a stack of cards, and almost all of its personality lives in four things: the depth ladder between background steps, the hairline borders, the single teal signal, and the closed four-color sport palette that repeats identically across activity dots, chart series, and the workout-mix bars.

This is a deliberate rejection of generic fitness-app cheerfulness — no bright gradients, no rounded-friendly illustration, no motivational color-pop UI. It is closer to a single-operator console: quiet by default, and the one accent color is reserved for the thing that actually matters on screen (a live streak, a CTA, the route itself).

Interactive surfaces are tactile and precise: state changes read as a deliberate switch flip (background steps from `card`/`transparent` to `raised-panel`) rather than a soft hover fade. Nothing animates without reason — the one motion primitive currently defined (`toast-in`) is reserved for exactly one job: announcing that something just arrived.

**Key Characteristics:**
- One signal color (Signal Teal) carries all "this is active/primary" meaning across buttons, the current streak stat, the weekly-distance bar, the calendar heatmap peak, and the route line.
- Depth comes from a four-step background ladder (Void Black → Deep Panel → Terminal Card → Raised Panel) plus hairline borders — not shadows.
- Every number is set in JetBrains Mono; every label is either a bold sans headline or a small uppercase mono-adjacent tag. There is no in-between.
- A closed, non-negotiable four-color sport palette (Run Teal / Strength Magenta / Ride Violet / Walk Blue) is the only place color carries categorical (not just state) meaning.

## Colors

Almost monochrome by design: a four-step dark neutral ladder, one signal color, a closed sport-category palette, and one reserved warm gradient waiting for its feature.

### Primary
- **Signal Teal** (`#2dd4bf`): the system's one "this matters" color. Used identically across the primary CTA background, the active/current streak `StatTile`, the weekly-distance chart bar, the top step of the activity-calendar heatmap, the sidebar logo-mark gradient, and the MapLibre route line — the same hex value, deliberately, in every one of those contexts.
- **Signal Teal Deep** (`#0e9488`): the gradient partner to Signal Teal in the logo mark, and the mid-step of the calendar heatmap ramp.

### Neutral
- **Void Black** (`#0b0f14`): page background (`html`), the darkest step of the ladder.
- **Deep Panel** (`#0e141b`): the sidebar/nav background — one step up from Void Black.
- **Terminal Card** (`#141b23`): the default surface for tiles, activity rows, chart containers, and the update toast.
- **Raised Panel** (`#1d2530`): the "activated" background step — active nav item, active tab, hover state on activity rows and nav links, and the MixBar track.
- **Ghost Line** (`rgb(255 255 255 / 0.08)`): the hairline border used on every card, tile, row, and panel edge. This is the system's only border color.
- **Readout White** (`#f1f4f7`): primary text and stat values.
- **Instrument Gray** (`#8792a0`): secondary text — labels, meta lines, inactive nav/tab text.
- **Dim Gray** (`#5b6472`): tertiary text — the least prominent copy (helper lines, chart axis labels).

### Sport Palette (closed set — do not extend ad hoc)
- **Run Teal** (`#2dd4bf`): Run, TrailRun. Identical value to Signal Teal — running is treated as the "home" sport.
- **Strength Magenta** (`#f472b6`): WeightTraining, Workout.
- **Ride Violet** (`#a78bfa`): Ride, VirtualRide.
- **Walk Blue** (`#60a5fa`): Walk, Hike.

### Reserved
- **Arrival Amber → Arrival Gold** (`#ff8a5c` → `#ffd166`): a warm gradient pair declared in the token set but not yet applied to any shipped component. It reads as earmarked for the live-arrival moment (an activity landing via the webhook/WebSocket path) — the one place a warm, urgent color would make sense against an otherwise cold-and-quiet palette. Do not repurpose it for anything else; wire it up or leave it reserved.

### Named Rules
**The One Signal Rule.** Signal Teal is the only color that means "primary / active / this matters." It never appears as decoration — every instance of it on screen is doing semantic work (a CTA, the current streak, the top of a chart, the route). If a new element needs emphasis, reach for Signal Teal only if that emphasis is genuinely primary; otherwise use the `raised-panel` background step instead.

**The Closed Sport Palette Rule.** The four sport colors are a fixed lookup table (`Run/TrailRun`, `Ride/VirtualRide`, `Walk/Hike`, `WeightTraining/Workout`), consumed identically by `ActivityRow`'s dot, `MixBar`'s fill, and the future legend of any new chart. A new sport type falls back to Instrument Gray rather than inventing a fifth color.

## Typography

**Display Font:** Space Grotesk (with ui-sans-serif, system-ui fallback)
**Body Font:** Manrope (with ui-sans-serif, system-ui fallback)
**Label/Mono Font:** JetBrains Mono (with ui-monospace, monospace fallback)

**Character:** A geometric, slightly technical display face over a warm, humanist body face, with every number pulled out into mono type. The pairing is what makes the "terminal" read work — headlines and body copy feel like a normal app, but the moment a number appears, it snaps into a fixed-width, telemetry-style register.

### Hierarchy
- **Display** (700, 27px, 1.2 line-height): page-level `<h1>` only ("Today", "Activities", "Progress", the activity name). Always paired with Space Grotesk.
- **Body** (500–700, 14px/13px, 1.5 line-height): default UI text — nav labels, buttons, section subheads (bold, muted-colored), meta descriptions.
- **Label** (600, 11px, 0.04em tracking, uppercase): `StatTile`'s small caption under the value. The only uppercase-tracked text in the system — reserved for that one role, not used for nav or section headers.
- **Mono** (700, 24px down to 12px depending on context, 1.1 line-height): every numeric readout — `StatTile` values, `ActivityRow`'s distance/duration/pace line, chart axis labels. Mono type is the visual signal for "this is data," at any size.

### Named Rules
**The All-Numbers-Are-Mono Rule.** Any value that is a measurement, count, duration, or pace renders in JetBrains Mono, regardless of font size or where it sits. Sans type is reserved for labels, names, and prose.

**The One Uppercase Rule.** Uppercase + letter-spacing is reserved for `StatTile` captions. It does not migrate to nav items, section headers, or buttons — those stay sentence case and bold instead.

## Layout

Single fixed sidebar (220px) plus a scrolling main column — no responsive collapse defined yet; the app is built for the owner's own desktop/tablet use first. Page content sits in a uniform `p-10` (40px) padding block regardless of route. Section rhythm steps in `mt-6`/`mt-8`/`mt-10` (24/32/40px) between a page's stat row, subheads, and content groups. Cards and rows stack with a tight `gap-2`/`gap-3` (8–12px). Stat tiles lay out as a `grid-cols-2 sm:grid-cols-4` responsive grid — the one place a breakpoint is currently used.

## Elevation & Depth

The system is flat by default. Depth is conveyed entirely through the four-step background ladder (Void Black → Deep Panel → Terminal Card → Raised Panel) and the single hairline `Ghost Line` border — never through shadows. The one exception is `UpdatePrompt`, a fixed-position toast floating above the page content, which carries a heavy drop shadow (`shadow-2xl`) precisely because it is the one element not resting on the page's own surface stack.

### Named Rules
**The Flat-by-Default Rule.** No component gets a shadow for being "important" or "elevated" in the ordinary card/tile/row sense — use the next background step up instead. A shadow is reserved for elements that are literally floating above the page (toasts, future popovers/modals), never for in-flow cards.

## Shapes

Corner radius scales with element size on a tight five-step ladder, not a generic sm/md/lg jump: **control** (10px — small buttons, the logo mark, tab pills), **nav** (11px — nav items, `AccountStatus` actions), **row** (13px — `ActivityRow`), **tile** (15px, `--radius-tile` — `StatTile`), **card** (18px, `--radius-card` — chart panels, the route-map frame, the update toast). All corners are soft rounded rectangles; there are no sharp corners, no pills except the tab buttons and the MixBar track/fill, and no clipping or angular cuts anywhere in the system.

## Components

### Buttons
- **Shape:** control radius (10px) for compact actions (ghost CTA, toast reload); nav radius (11px) for the full-width sidebar/account actions.
- **Primary:** Signal Teal background, Void Black text, bold — used for "Connect Strava" and the toast's "Reload" action. Reserved for the single most important action on screen.
- **Ghost:** transparent background, dashed Ghost Line border, Instrument Gray text — used for a low-commitment, optional action (`EnableNotifications`). Hover shifts the border to Instrument Gray.
- **Secondary (nav/account "Log out"):** transparent background, Instrument Gray text, hover steps to Raised Panel — same visual language as an inactive nav item, not a distinct button style.

### Cards / Containers
- **Corner Style:** tile radius (15px) for `StatTile`; card radius (18px) for everything larger (chart panels, route-map frame).
- **Background:** Terminal Card.
- **Shadow Strategy:** none — see Elevation & Depth. Depth comes from sitting on Terminal Card against a Deep Panel or Void Black backdrop.
- **Border:** Ghost Line hairline on every card.
- **Internal Padding:** 16px (`p-4`) standard, 20px (`p-5`) for the wider MixBar panel.

### Activity Row (signature component)
A single-line, densely-packed record: an 8px sport-color dot, a bold truncated title, and a right-aligned mono meta string (distance · duration · pace). Terminal Card background, Ghost Line border, row radius (13px), hover steps to Raised Panel. This is the system's core repeating unit — the entire Timeline view is a stack of these.

### Tabs
- **Style:** pill-shaped buttons in a `role="tablist"` row, control radius (10px), bold 11–12px text.
- **Active/Inactive:** active = Raised Panel background + Readout White text; inactive = Instrument Gray text, hover steps to Raised Panel. Identical state language to nav items.

### Navigation
Fixed 220px sidebar, Deep Panel background, Ghost Line right border. Logo mark is an 8×8 (32px) rounded-square (10px radius) teal gradient tile with a small pace-bolt glyph. Nav items are full-width, nav radius (11px), bold 14px text; active state is Raised Panel + Readout White, inactive is Instrument Gray with a Raised Panel hover step. No animated indicator — state is purely a background swap.

### Charts (signature pattern)
ECharts panels share one restrained palette: axis lines and split lines in Raised Panel gray, axis labels in Dim Gray/Instrument Gray at 10px, and exactly one data color — Signal Teal — for the meaningful series (the weekly-distance bar). The activity calendar heatmap ramps from Terminal Card through Signal Teal Deep to Signal Teal, so "more activity" always resolves toward the same signal color used everywhere else. The route map (MapLibre, dark tile style) draws its line in Signal Teal at 3px with rounded joins — the same color, once more, for "the thing the athlete actually did."

## Do's and Don'ts

### Do:
- **Do** keep Signal Teal to a single, consistent semantic role (primary/active/current) across every surface — button, stat, chart, map alike.
- **Do** use the background-ladder step (not a shadow) whenever a component needs to read as "raised" or "focused."
- **Do** render every measurement, count, duration, and pace value in JetBrains Mono, at whatever size the context calls for.
- **Do** treat the four sport colors as a closed, fixed lookup table shared by every component that displays a sport type.
- **Do** reserve uppercase + letter-spacing exclusively for `StatTile`-style meta captions.

### Don't:
- **Don't** add a shadow to an in-flow card, tile, or row — shadows are reserved for elements floating above the page (toasts, future modals/popovers).
- **Don't** introduce a second "primary" accent color alongside Signal Teal, or use Signal Teal purely decoratively.
- **Don't** invent a fifth sport color ad hoc; fall back to Instrument Gray for an unmapped sport type instead.
- **Don't** reach for bright, rounded, "cheerful fitness app" visual language (illustration, gradients-as-decoration, playful iconography) — the system is a quiet instrument panel, not a lifestyle brand.
- **Don't** repurpose Arrival Amber/Gold or the `toast-in` animation for anything other than the live-arrival moment they're reserved for.
