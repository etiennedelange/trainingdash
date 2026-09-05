# Gamification Design — Portfolio Site

**Date:** 2026-05-31  
**Status:** Approved  
**Approach:** Silent Layer Cake (B) + Hidden Terminal (C)

---

## Overview

Add layered gamification to the portfolio site that preserves its minimalist neobrutalist aesthetic. Casual visitors see a clean, fast site. Curious visitors discover interactive surprises. Developers who dig find a hidden command palette and achievement system. No persistent UI chrome is added — the gamification lives in the interactions, not in new widgets.

---

## The Three Layers

### Layer 1 — Surface (every visitor)

**Stats count-up**  
The four hero stats (`15+`, `6`, `2`, `Cum Laude`) animate from zero to their target value when their section scrolls into the viewport. Uses `IntersectionObserver`; fires once per page load. The numeric stats use a rolling counter; `Cum Laude` types in character by character.

**Skill tag stamps**  
Clicking any skill tag in the Skills section triggers a neobrutalist "stamp" animation: brief scale-up with a hard shadow burst, then snaps back. Implemented as a Svelte action (`use:stamp`) that toggles a CSS class for ~300ms.

**Scroll progress bar**  
A 2px accent-coloured (`var(--c-accent)`) line runs along the bottom edge of the fixed nav header. Its width tracks `window.scrollY / (document.body.scrollHeight - window.innerHeight)`. Fits the existing border language of the design system.

**Console personality**  
On page load, a styled `console.log` block prints:
```
╔══════════════════════════════════╗
║   Hi, I'm Etienne de Lange       ║
║   Software Engineer              ║
╚══════════════════════════════════╝
Curious about the source? Try pressing / anywhere.
```

---

### Layer 2 — Mid (curious visitors who explore)

**Portrait modes**  
Clicking the portrait photo cycles through 4 states. Each state is a CSS class applied to `.portrait-frame`:

| Mode | Class | Effect |
|------|-------|--------|
| 0 | *(default)* | Normal duotone + light grain |
| 1 | `.portrait-mode-contrast` | High-contrast duotone, grain off |
| 2 | `.portrait-mode-glitch` | Glitch displacement — CSS `hue-rotate` + exaggerated grain |
| 3 | `.portrait-mode-scanlines` | Scanlines dominant, grain off, desaturated |

Cycling through all 4 modes unlocks the `portrait_cycler` achievement. Both portrait instances (hero section on desktop, about section on mobile) share the same `portraitMode` store value and are both clickable.

**Footer secret**  
A line is hidden below the footer with `opacity: 0; pointer-events: none`. When `window.scrollY + window.innerHeight >= document.body.scrollHeight - 4`, it transitions to `opacity: 1`. Text: *"You made it. Most people don't scroll this far."* Triggers the `deep_diver` achievement on first reveal.

**Logo tap**  
Clicking the `Etienne.` logo nav link 5× within 2 seconds triggers a brief overlay: the nav logo text animates through a fake "loading…" sequence then resolves to a one-liner (e.g. *"Still loading personality… just kidding."*). Unlocks `logo_tap` achievement.

---

### Layer 3 — Deep (developers)

**`/` Command Palette**  
Pressing `/` when focus is not in a form field opens a full-screen neobrutalist terminal overlay. Styled with `var(--c-ink)` border, `var(--c-bg)` background, `var(--c-accent)` prompt cursor — matching the existing design system exactly. Closeable with `Esc` or clicking the backdrop.

Body scroll is locked (`overflow: hidden`) while the terminal is open. The `/` key is ignored if `event.target` is an `<input>`, `<textarea>`, or `[contenteditable]`.

**Commands:**

| Command | Output |
|---------|--------|
| `help` | Lists all commands with one-line descriptions |
| `whoami` | Short bio with more personality than the About section |
| `skills` | Grouped skill list matching the Skills section |
| `experience` | Compact timeline: company → role → period |
| `contact` | Email + phone with clickable `mailto:` link |
| `achievements --list` | All achievements with locked/unlocked state + trigger hints |
| `clear` | Clears terminal output |
| *(unknown)* | `command not found: <cmd>. Type 'help' for available commands.` |

Opening the terminal for the first time unlocks `terminal_found`.

**Achievements** (tracked in `localStorage`, no visible UI except via terminal):

| Key | Trigger |
|-----|---------|
| `dark_knight` | Toggle dark mode |
| `night_owl` | Visit between 00:00–01:00 |
| `golden_hour` | Visit between 16:00–17:00 |
| `deep_diver` | Scroll to the absolute bottom |
| `portrait_cycler` | Cycle through all 4 portrait modes |
| `time_lord` | Use the Alt+T time slider |
| `terminal_found` | Open the command palette |
| `skill_stamper` | Stamp 5+ distinct skill tags |
| `logo_tap` | Trigger the logo easter egg |

---

## Architecture

### New files

**`src/lib/components/Terminal.svelte`**  
Self-contained command palette overlay. Props: `open: boolean` (bindable). When `Esc` is pressed or the backdrop is clicked, the component sets `open = false` directly via the bindable prop. Handles command parsing and output rendering internally.

**`src/lib/gameState.ts`**  
Svelte store wrapping `localStorage`. Exports:
- `achievements: Writable<string[]>` — persisted as JSON array (Set semantics via `includes` check)
- `portraitMode: Writable<0 | 1 | 2 | 3>` — ephemeral, not persisted (resets on reload)
- `unlock(key: string): void` — idempotent; no-ops if key already present, otherwise appends and persists

If `localStorage` is unavailable (private browsing, quota exceeded), achievements silently degrade — the terminal still works, unlocks just aren't persisted.

**`src/lib/actions/countUp.ts`**  
Svelte action: `use:countUp={{ target: number | string, duration: number }}`. Uses `IntersectionObserver` to fire once on first intersection. Animates numeric values with `requestAnimationFrame`; non-numeric values (e.g. `Cum Laude`) type in character by character.

**`src/lib/actions/stamp.ts`**  
Svelte action: `use:stamp`. On click, adds `.is-stamped` class to the element for 300ms then removes it. The CSS animation lives in `layout.css`.

### Modified files

**`src/routes/+page.svelte`**  
- `onMount`: print console easter egg; register `/` keydown listener; register scroll listener for progress bar + footer secret
- Portrait click handler: increments `portraitMode` store mod 4; checks for `portrait_cycler` achievement
- Logo click counter: tracks rapid clicks with a timeout
- Add `<Terminal bind:open={terminalOpen} />` near end of template
- Add `use:countUp` to each stat value element
- Wire achievement unlocks: dark mode toggle → `dark_knight`; time slider use → `time_lord`

**`src/routes/layout.css`**  
- `.scroll-progress` — the nav progress bar element styles
- `@keyframes stamp-pop` — scale + shadow burst animation for skill tags
- `.is-stamped` — applies `stamp-pop`
- `.portrait-mode-contrast`, `.portrait-mode-glitch`, `.portrait-mode-scanlines` — portrait filter overrides

**`src/lib/components/DotGrid.svelte`**  
No changes required.

---

## Error Handling

- `localStorage` unavailable: `gameState.ts` catches the error and operates as an in-memory store for the session
- `IntersectionObserver` unavailable: `countUp` action falls back to rendering the final value immediately
- Portrait mode click on non-image target: click handler is bound to the `<img>` element directly, not the frame

---

## Testing

- `src/lib/gameState.ts`: Vitest unit tests for `unlock()` idempotency and localStorage persistence
- `src/lib/actions/countUp.ts`: Vitest smoke test — action attaches observer, callback fires correctly
- No tests for easter egg interactions themselves (pure UX, not business logic)
