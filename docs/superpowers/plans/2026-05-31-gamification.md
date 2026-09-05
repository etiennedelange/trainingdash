# Portfolio Gamification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a three-layer gamification system — surface micro-interactions for all visitors, mid-layer easter eggs for curious explorers, and a hidden `/` command palette with achievement tracking for developers.

**Architecture:** Four new files (gameState store, countUp action, stamp action, Terminal component) plus augmented page.svelte and layout.css. No new routes, no server-side changes, no added UI chrome. All gamification is client-only and degrades gracefully without JS APIs.

**Tech Stack:** SvelteKit, Svelte 5 (`$state`, `$effect`, `$bindable`, `$props`), TypeScript, `svelte/store` (`writable`, `get`), CSS animations/keyframes, `IntersectionObserver`, `localStorage`, `requestAnimationFrame`

---

### Task 1: gameState store

**Files:**
- Create: `src/lib/gameState.ts`
- Create: `src/lib/gameState.spec.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/gameState.spec.ts
import { describe, it, expect } from 'vitest';
import { get } from 'svelte/store';
import { createGameState } from '$lib/gameState';

interface MockStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  data: Map<string, string>;
}

function mockStorage(): MockStorage {
  const data = new Map<string, string>();
  return {
    get: (k) => data.get(k) ?? null,
    set: (k, v) => { data.set(k, v); },
    data,
  };
}

describe('createGameState', () => {
  it('starts with empty achievements when storage is empty', () => {
    const gs = createGameState(mockStorage());
    expect(get(gs.achievements)).toEqual([]);
  });

  it('unlock() adds a key to achievements', () => {
    const gs = createGameState(mockStorage());
    gs.unlock('dark_knight');
    expect(get(gs.achievements)).toContain('dark_knight');
  });

  it('unlock() is idempotent — duplicate keys are ignored', () => {
    const gs = createGameState(mockStorage());
    gs.unlock('dark_knight');
    gs.unlock('dark_knight');
    expect(get(gs.achievements).filter((k) => k === 'dark_knight')).toHaveLength(1);
  });

  it('persists achievements to storage as JSON', () => {
    const storage = mockStorage();
    const gs = createGameState(storage);
    gs.unlock('night_owl');
    expect(JSON.parse(storage.data.get('portfolio_achievements')!)).toContain('night_owl');
  });

  it('reads existing achievements from storage on creation', () => {
    const storage = mockStorage();
    storage.set('portfolio_achievements', JSON.stringify(['terminal_found']));
    const gs = createGameState(storage);
    expect(get(gs.achievements)).toContain('terminal_found');
  });

  it('survives storage read errors gracefully', () => {
    const broken = { get: () => { throw new Error('blocked'); }, set: () => {}, data: new Map() };
    const gs = createGameState(broken);
    expect(get(gs.achievements)).toEqual([]);
  });

  it('survives storage write errors gracefully', () => {
    const broken = { get: () => null, set: () => { throw new Error('quota'); }, data: new Map() };
    const gs = createGameState(broken);
    expect(() => gs.unlock('test')).not.toThrow();
    expect(get(gs.achievements)).toContain('test');
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm test:unit -- --run src/lib/gameState.spec.ts
```
Expected: FAIL — `$lib/gameState` not found.

- [ ] **Step 3: Implement gameState.ts**

```typescript
// src/lib/gameState.ts
import { writable } from 'svelte/store';

const STORAGE_KEY = 'portfolio_achievements';

export interface StorageAdapter {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

const localStorageAdapter: StorageAdapter = {
  get(key) {
    try { return localStorage.getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { localStorage.setItem(key, value); } catch { /* silently degrade */ }
  },
};

export function createGameState(storage: StorageAdapter = localStorageAdapter) {
  let initial: string[] = [];
  try {
    const stored = storage.get(STORAGE_KEY);
    if (stored) initial = JSON.parse(stored);
  } catch { /* malformed JSON — start fresh */ }

  const achievements = writable<string[]>(initial);

  function unlock(key: string): void {
    achievements.update((prev) => {
      if (prev.includes(key)) return prev;
      const next = [...prev, key];
      storage.set(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { achievements, unlock };
}

export const gameState = createGameState();
```

- [ ] **Step 4: Run to confirm tests pass**

```bash
pnpm test:unit -- --run src/lib/gameState.spec.ts
```
Expected: 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/gameState.ts src/lib/gameState.spec.ts
git commit -m "feat: add gameState store with achievement tracking and localStorage persistence"
```

---

### Task 2: countUp Svelte action

**Files:**
- Create: `src/lib/actions/countUp.ts`
- Create: `src/lib/actions/countUp.svelte.spec.ts`

Note: the `.svelte.spec.ts` extension runs this test in the browser (Chromium via Playwright) where `IntersectionObserver` and real DOM are available.

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/actions/countUp.svelte.spec.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { countUp } from '$lib/actions/countUp';

describe('countUp action', () => {
  afterEach(() => vi.restoreAllMocks());

  it('observes the node via IntersectionObserver', () => {
    const node = document.createElement('span');
    const spy = vi.spyOn(IntersectionObserver.prototype, 'observe');
    countUp(node, { target: '15+' });
    expect(spy).toHaveBeenCalledWith(node);
  });

  it('sets text to final value immediately when IntersectionObserver unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const node = document.createElement('span');
    countUp(node, { target: '15+' });
    expect(node.textContent).toBe('15+');
  });

  it('sets non-numeric text to final value immediately when IO unavailable', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    const node = document.createElement('span');
    countUp(node, { target: 'Cum Laude' });
    expect(node.textContent).toBe('Cum Laude');
  });

  it('disconnects observer on destroy', () => {
    const node = document.createElement('span');
    const spy = vi.spyOn(IntersectionObserver.prototype, 'disconnect');
    const action = countUp(node, { target: 6 });
    action?.destroy?.();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

```bash
pnpm test:unit -- --run src/lib/actions/countUp.svelte.spec.ts
```
Expected: FAIL — `$lib/actions/countUp` not found.

- [ ] **Step 3: Implement countUp.ts**

```typescript
// src/lib/actions/countUp.ts
import type { Action } from 'svelte/action';

export const countUp: Action<HTMLElement, { target: number | string; duration?: number }> = (
  node,
  params
) => {
  const { target, duration = 1200 } = params;
  const str = String(target);
  const match = str.match(/^(\d+(?:\.\d+)?)(.*)$/);
  const isNumeric = match !== null;

  let observer: IntersectionObserver | undefined;
  let fired = false;

  function animate() {
    if (fired) return;
    fired = true;

    if (!isNumeric) {
      node.textContent = '';
      let i = 0;
      const delay = Math.max(40, duration / str.length);
      const id = setInterval(() => {
        node.textContent = str.slice(0, ++i);
        if (i >= str.length) clearInterval(id);
      }, delay);
      return;
    }

    const numeric = parseFloat(match[1]);
    const suffix = match[2];
    const startTime = performance.now();

    function tick(now: number) {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      node.textContent = String(Math.round(numeric * eased)) + suffix;
      if (progress < 1) requestAnimationFrame(tick);
    }

    node.textContent = '0' + suffix;
    requestAnimationFrame(tick);
  }

  if (typeof IntersectionObserver !== 'undefined') {
    node.textContent = isNumeric ? '0' + (match?.[2] ?? '') : '';
    observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) animate(); },
      { threshold: 0.5 }
    );
    observer.observe(node);
  } else {
    node.textContent = str;
  }

  return { destroy() { observer?.disconnect(); } };
};
```

- [ ] **Step 4: Run to confirm tests pass**

```bash
pnpm test:unit -- --run src/lib/actions/countUp.svelte.spec.ts
```
Expected: 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/countUp.ts src/lib/actions/countUp.svelte.spec.ts
git commit -m "feat: add countUp action — IntersectionObserver-driven animated stat reveal"
```

---

### Task 3: stamp Svelte action + CSS keyframes

**Files:**
- Create: `src/lib/actions/stamp.ts`
- Modify: `src/routes/layout.css`

- [ ] **Step 1: Create stamp.ts**

```typescript
// src/lib/actions/stamp.ts
import type { Action } from 'svelte/action';

export const stamp: Action<HTMLElement> = (node) => {
  function handleClick() {
    node.classList.add('is-stamped');
    setTimeout(() => node.classList.remove('is-stamped'), 350);
  }
  node.addEventListener('click', handleClick);
  return { destroy() { node.removeEventListener('click', handleClick); } };
};
```

- [ ] **Step 2: Add stamp animation CSS to end of layout.css**

```css
/* ── Stamp animation (skill tags) ─────────────────────────── */
@keyframes stamp-pop {
  0%   { transform: scale(1);    box-shadow: 2px 2px 0 var(--c-shadow); }
  35%  { transform: scale(1.18); box-shadow: 6px 6px 0 var(--c-shadow); }
  65%  { transform: scale(0.95); box-shadow: 1px 1px 0 var(--c-shadow); }
  100% { transform: scale(1);    box-shadow: 2px 2px 0 var(--c-shadow); }
}

.is-stamped {
  animation: stamp-pop 0.35s ease forwards;
}

.neo-tag {
  cursor: pointer;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/stamp.ts src/routes/layout.css
git commit -m "feat: add stamp action and CSS animation for skill tag interaction"
```

---

### Task 4: CSS additions for all visual features

**Files:**
- Modify: `src/routes/layout.css`

Add each block to the end of the file in the order below.

- [ ] **Step 1: Scroll progress bar styles**

```css
/* ── Scroll progress bar ──────────────────────────────────── */
.scroll-progress {
  position: absolute;
  bottom: -2px;
  left: 0;
  height: 2px;
  background-color: var(--c-accent);
  transition: width 0.1s linear, background-color 0.6s ease;
  pointer-events: none;
}
```

- [ ] **Step 2: Portrait mode CSS classes**

```css
/* ── Portrait interaction modes ───────────────────────────── */
.portrait-frame {
  cursor: pointer;
}

.portrait-mode-contrast .portrait-img {
  filter: grayscale(1) contrast(2.2) brightness(0.9);
}
.portrait-mode-contrast .portrait-grain {
  opacity: 0 !important;
}

.portrait-mode-glitch .portrait-img {
  filter: grayscale(0.3) contrast(1.6) hue-rotate(15deg) brightness(1.1);
  animation: glitch-shift 0.18s steps(1) infinite;
}
.portrait-mode-glitch .portrait-grain {
  opacity: 0.35 !important;
  animation-duration: 0.08s !important;
}

@keyframes glitch-shift {
  0%   { transform: translate(0,    0);   }
  20%  { transform: translate(-3px, 1px); }
  40%  { transform: translate(2px, -2px); }
  60%  { transform: translate(-1px, 3px); }
  80%  { transform: translate(3px, -1px); }
  100% { transform: translate(0,    0);   }
}

.portrait-mode-scanlines .portrait-img {
  filter: grayscale(1) contrast(1.1) brightness(0.95);
  mix-blend-mode: normal;
}
.portrait-mode-scanlines .portrait-grain {
  opacity: 0 !important;
}
.portrait-mode-scanlines .portrait-lines {
  background: repeating-linear-gradient(
    0deg,
    transparent,
    transparent 1px,
    rgba(0, 0, 0, 0.25) 1px,
    rgba(0, 0, 0, 0.25) 2px
  );
}
```

- [ ] **Step 3: Footer secret styles**

```css
/* ── Footer secret ────────────────────────────────────────── */
.footer-secret {
  text-align: center;
  font-size: 0.75rem;
  font-style: italic;
  padding: 0.75rem 1rem 1.5rem;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.8s ease;
  color: var(--c-muted);
}

.footer-secret.is-visible {
  opacity: 1;
  pointer-events: auto;
}
```

- [ ] **Step 4: Logo easter egg tooltip styles**

```css
/* ── Logo easter egg tooltip ──────────────────────────────── */
.logo-wrap {
  position: relative;
  display: inline-block;
}

.logo-tooltip {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  white-space: nowrap;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 4px 10px;
  background-color: var(--c-bg);
  border: 2px solid var(--c-ink);
  box-shadow: 3px 3px 0 var(--c-shadow);
  color: var(--c-ink);
  z-index: 100;
  pointer-events: none;
  transition: border-color 0.25s ease, background-color 0.25s ease;
}
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/layout.css
git commit -m "feat: add CSS for scroll progress, portrait modes, footer secret, logo tooltip"
```

---

### Task 5: State, imports, console easter egg, and time-based achievements

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add gameState import and new state variables to the script block**

In `src/routes/+page.svelte`, add this import after the existing imports at the top of `<script lang="ts">`:

```typescript
import { gameState } from '$lib/gameState';
```

Add these state variables after the existing `let` declarations:

```typescript
let terminalOpen = $state(false);
let scrollProgress = $state(0);
let footerSecretVisible = $state(false);
let portraitMode = $state<0 | 1 | 2 | 3>(0);
let portraitCycled = $state(false);
let stampedSkills = $state(new Set<string>());
let logoTapCount = $state(0);
let logoTapTimer: ReturnType<typeof setTimeout> | null = null;
let logoMessage = $state('');
```

- [ ] **Step 2: Replace the entire onMount block**

Replace the current `onMount(() => { ... })` with this version that consolidates all listeners and adds the easter egg:

```typescript
onMount(() => {
  // Console easter egg
  console.log(
    '%c╔══════════════════════════════════╗\n' +
    "║   Hi, I'm Etienne de Lange       ║\n" +
    '║   Software Engineer              ║\n' +
    '╚══════════════════════════════════╝',
    'color: #f5d90a; font-family: monospace; font-size: 13px;'
  );
  console.log(
    '%cCurious about the source? Try pressing / anywhere.',
    'color: #6b7280; font-size: 12px;'
  );

  // Time-based achievements
  const hour = new Date().getHours();
  if (hour === 0) gameState.unlock('night_owl');
  if (hour === 16) gameState.unlock('golden_hour');

  // Scroll listener
  const handleScroll = () => {
    scrolled = window.scrollY > 40;
    const maxScroll = document.body.scrollHeight - window.innerHeight;
    scrollProgress = maxScroll > 0 ? window.scrollY / maxScroll : 0;
    if (
      !footerSecretVisible &&
      window.scrollY + window.innerHeight >= document.body.scrollHeight - 4
    ) {
      footerSecretVisible = true;
      gameState.unlock('deep_diver');
    }
  };
  window.addEventListener('scroll', handleScroll, { passive: true });

  return () => window.removeEventListener('scroll', handleScroll);
});
```

- [ ] **Step 3: Add time_lord achievement wiring**

After the existing `$effect` for `applyTimePalette`, add:

```typescript
$effect(() => {
  if (testHour !== null) gameState.unlock('time_lord');
});
```

- [ ] **Step 4: Lock body scroll while terminal is open**

After the `time_lord` effect, add:

```typescript
$effect(() => {
  document.body.style.overflow = terminalOpen ? 'hidden' : '';
});
```

- [ ] **Step 5: Update handleKeydown to add / shortcut**

Replace the existing `handleKeydown` function:

```typescript
function handleKeydown(e: KeyboardEvent) {
  if (e.altKey && e.key === 't') sliderVisible = !sliderVisible;

  const tag = (e.target as HTMLElement).tagName;
  const editable = (e.target as HTMLElement).isContentEditable;
  if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA' && !editable) {
    e.preventDefault();
    if (!terminalOpen) {
      terminalOpen = true;
      gameState.unlock('terminal_found');
    }
  }
}
```

- [ ] **Step 6: Update toggleDark to unlock dark_knight**

Replace the existing `toggleDark` function:

```typescript
function toggleDark() {
  isDark = !isDark;
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  gameState.unlock('dark_knight');
}
```

- [ ] **Step 7: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add game state wiring, console easter egg, time/scroll/dark achievements"
```

---

### Task 6: Scroll progress bar + stats count-up in the template

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add countUp import**

In `src/routes/+page.svelte`, add after the existing imports:

```typescript
import { countUp } from '$lib/actions/countUp';
```

- [ ] **Step 2: Add scroll progress bar to nav header**

Find the closing `</header>` tag. Just before it (after the `{#if menuOpen}` block), add:

```svelte
<div class="scroll-progress" style:width="{scrollProgress * 100}%"></div>
```

- [ ] **Step 3: Wire countUp to stat elements**

Find the stats grid block (search for `{ value: '15+', label: 'Years experience' }`). Change the stat value `<p>` element from:

```svelte
<p class="text-3xl font-bold">{stat.value}</p>
```

to:

```svelte
<p class="text-3xl font-bold" use:countUp={{ target: stat.value }}>{stat.value}</p>
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add scroll progress bar and animated stats count-up on scroll-into-view"
```

---

### Task 7: Skill tag stamps + skill_stamper achievement

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add stamp import**

In `src/routes/+page.svelte`, add after the existing imports:

```typescript
import { stamp } from '$lib/actions/stamp';
```

- [ ] **Step 2: Add stamp handler function to script block**

```typescript
function handleSkillStamp(skill: string) {
  if (stampedSkills.has(skill)) return;
  stampedSkills = new Set([...stampedSkills, skill]);
  if (stampedSkills.size >= 5) gameState.unlock('skill_stamper');
}
```

- [ ] **Step 3: Wire stamp and handler to skill tags in the Skills section**

Find the `{#each group.skills as skill (skill)}` loop inside the Skills section. Change:

```svelte
<span class="neo-tag">{skill}</span>
```

to:

```svelte
<span class="neo-tag" use:stamp onclick={() => handleSkillStamp(skill)}>{skill}</span>
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add skill tag stamp animation and skill_stamper achievement"
```

---

### Task 8: Portrait mode cycling + portrait_cycler achievement

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add portrait cycle handler to script block**

```typescript
function cyclePortrait() {
  portraitMode = ((portraitMode + 1) % 4) as 0 | 1 | 2 | 3;
  if (portraitMode === 0 && !portraitCycled) {
    portraitCycled = true;
    gameState.unlock('portrait_cycler');
  }
}
```

- [ ] **Step 2: Wire portrait mode to the hero portrait**

Find the hero portrait (`class="portrait-frame w-56 xl:w-64"`). Replace the opening div with:

```svelte
<div
  class="portrait-frame w-56 xl:w-64"
  class:portrait-mode-contrast={portraitMode === 1}
  class:portrait-mode-glitch={portraitMode === 2}
  class:portrait-mode-scanlines={portraitMode === 3}
  onclick={cyclePortrait}
  role="button"
  tabindex="0"
  aria-label="Cycle portrait filter"
  onkeydown={(e) => e.key === 'Enter' && cyclePortrait()}
>
```

- [ ] **Step 3: Wire portrait mode to the about section portrait**

Find the about section portrait (`class="portrait-frame w-40"`). Replace the opening div with:

```svelte
<div
  class="portrait-frame w-40"
  class:portrait-mode-contrast={portraitMode === 1}
  class:portrait-mode-glitch={portraitMode === 2}
  class:portrait-mode-scanlines={portraitMode === 3}
  onclick={cyclePortrait}
  role="button"
  tabindex="0"
  aria-label="Cycle portrait filter"
  onkeydown={(e) => e.key === 'Enter' && cyclePortrait()}
>
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add portrait mode cycling through 4 retro filter states"
```

---

### Task 9: Footer secret reveal

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add the hidden message element after the closing `</footer>` tag**

```svelte
<p class="footer-secret" class:is-visible={footerSecretVisible}>
  You made it. Most people don't scroll this far.
</p>
```

The scroll handler in Task 5 already sets `footerSecretVisible = true` and unlocks `deep_diver` when the user hits the bottom — nothing more is needed.

- [ ] **Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add footer secret message revealed on scroll to bottom"
```

---

### Task 10: Logo tap easter egg

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add the logo tap handler to script block**

```typescript
function handleLogoClick(e: MouseEvent) {
  logoTapCount++;
  if (logoTapTimer) clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(() => { logoTapCount = 0; }, 2000);

  if (logoTapCount >= 5) {
    e.preventDefault();
    logoTapCount = 0;
    clearTimeout(logoTapTimer!);
    logoTapTimer = null;
    gameState.unlock('logo_tap');
    logoMessage = 'Loading…';
    setTimeout(() => {
      logoMessage = 'Still loading personality… just kidding.';
      setTimeout(() => { logoMessage = ''; }, 2500);
    }, 700);
  }
}
```

- [ ] **Step 2: Wrap the nav logo in the tooltip container**

In the desktop nav, find the logo `<a href="/">` element and replace it with:

```svelte
<div class="logo-wrap">
  <a
    href="/"
    onclick={handleLogoClick}
    class="text-lg font-bold tracking-tight hover:opacity-70 transition-opacity"
    style="color: var(--c-ink);"
  >
    Etienne<span style="color: var(--c-accent);" class="ml-1">.</span>
  </a>
  {#if logoMessage}
    <div class="logo-tooltip">{logoMessage}</div>
  {/if}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: add logo tap easter egg — 5 rapid clicks triggers cheeky loading message"
```

---

### Task 11: Terminal component

**Files:**
- Create: `src/lib/components/Terminal.svelte`

- [ ] **Step 1: Create Terminal.svelte**

```svelte
<!-- src/lib/components/Terminal.svelte -->
<script lang="ts">
  import { get } from 'svelte/store';
  import { gameState } from '$lib/gameState';

  let { open = $bindable(false) }: { open: boolean } = $props();

  type Line = { type: 'cmd' | 'out'; text: string };

  let input = $state('');
  let history = $state<Line[]>([{ type: 'out', text: 'Type "help" to see available commands.' }]);
  let inputEl = $state<HTMLInputElement | null>(null);

  $effect(() => {
    if (open) setTimeout(() => inputEl?.focus(), 50);
  });

  function close() {
    open = false;
    input = '';
  }

  function handleBackdropClick(e: MouseEvent) {
    if (e.target === e.currentTarget) close();
  }

  function handleInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') close();
    if (e.key === 'Enter') submit();
  }

  function submit() {
    const cmd = input.trim();
    if (!cmd) return;
    if (cmd.toLowerCase() === 'clear') {
      history = [];
      input = '';
      return;
    }
    history = [...history, { type: 'cmd', text: `❯ ${cmd}` }, ...runCommand(cmd)];
    input = '';
  }

  function runCommand(raw: string): Line[] {
    const parts = raw.trim().toLowerCase().split(/\s+/);
    const cmd = parts[0];
    const args = parts.slice(1);

    switch (cmd) {
      case 'help':
        return [{ type: 'out', text: [
          'Available commands:',
          '  whoami              — about me',
          '  skills              — tech stack',
          '  experience          — work history',
          '  contact             — get in touch',
          '  achievements --list — unlocked achievements',
          '  clear               — clear terminal',
        ].join('\n') }];

      case 'whoami':
        return [{ type: 'out', text: [
          'Etienne de Lange — Software Engineer, Port Elizabeth, South Africa.',
          '15+ years building software across desktop, mobile, web, and cloud.',
          'Currently at Powerfleet, leaning hard into agentic AI engineering.',
          'Firm believer that clean, reviewable code is the foundation of great products.',
          'Cum Laude graduate. Occasional over-engineer. Always curious.',
        ].join('\n') }];

      case 'skills':
        return [{ type: 'out', text: [
          'Cloud & DevOps  — Azure, Azure DevOps, CI/CD, IIS',
          'Backend         — .NET/C#, ASP.NET Core, Entity Framework, SQL, NodeJS',
          'Frontend        — Angular, TypeScript, JavaScript, HTML/CSS, SignalR',
          'Mobile/Desktop  — iOS, Android, Xamarin, WPF, WinForms',
          'AI & Agentic    — GitHub Copilot, Claude Code, AI Agents, Prompt Engineering',
          'Tools           — Git, GitHub, Agile/Scrum, JIRA, VS Code',
        ].join('\n') }];

      case 'experience':
        return [{ type: 'out', text: [
          'Powerfleet          Software Engineer         2023 – Present',
          'MRI Software        Software Engineer III     May 2022 – 2023',
          'LexisNexis          Mid–Senior Engineer       May 2016 – May 2022',
          'Tigers Limited      Mid–Senior Engineer       Nov 2015 – Mar 2016',
          'Property24          Mid-level Engineer        Nov 2014 – Oct 2015',
          'Korbitec            Junior–Mid Engineer       Jan 2011 – Oct 2014',
        ].join('\n') }];

      case 'contact':
        return [{ type: 'out', text: [
          'Email:    etienne.de.lange1@gmail.com',
          'Phone:    +27 76 920 9230',
          'Location: Port Elizabeth, South Africa',
        ].join('\n') }];

      case 'achievements': {
        if (args[0] === '--list') {
          const unlocked = get(gameState.achievements);
          const all = [
            { key: 'dark_knight',     hint: 'toggle dark mode' },
            { key: 'night_owl',       hint: 'visit between 00:00–01:00' },
            { key: 'golden_hour',     hint: 'visit between 16:00–17:00' },
            { key: 'deep_diver',      hint: 'scroll to the very bottom' },
            { key: 'portrait_cycler', hint: 'cycle through all portrait modes' },
            { key: 'time_lord',       hint: 'use the time slider (alt+t)' },
            { key: 'terminal_found',  hint: 'you already found this one' },
            { key: 'skill_stamper',   hint: 'click 5 distinct skill tags' },
            { key: 'logo_tap',        hint: 'click the logo 5× quickly' },
          ];
          const lines = all.map((a) =>
            `${unlocked.includes(a.key) ? '✓' : '○'} ${a.key.padEnd(18)} ${
              unlocked.includes(a.key) ? '(unlocked)' : `hint: ${a.hint}`
            }`
          );
          return [{ type: 'out', text: ['Achievements:', ...lines].join('\n') }];
        }
        return [{ type: 'out', text: 'Usage: achievements --list' }];
      }

      default:
        return [{ type: 'out', text: `command not found: ${cmd}. Type 'help' for available commands.` }];
    }
  }
</script>

{#if open}
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="terminal-backdrop"
  onclick={handleBackdropClick}
  onkeydown={(e) => e.key === 'Escape' && close()}
>
  <div class="terminal-window" role="dialog" aria-label="Command terminal" aria-modal="true">
    <div class="terminal-header">
      <span class="terminal-title">terminal</span>
      <button class="terminal-close" onclick={close} aria-label="Close terminal">✕</button>
    </div>
    <div class="terminal-output">
      {#each history as line, i (i)}
        <pre class="terminal-line" class:is-cmd={line.type === 'cmd'}>{line.text}</pre>
      {/each}
    </div>
    <div class="terminal-input-row">
      <span class="terminal-prompt">❯</span>
      <input
        bind:this={inputEl}
        bind:value={input}
        onkeydown={handleInputKeydown}
        class="terminal-input"
        autocomplete="off"
        spellcheck={false}
        aria-label="Terminal command input"
        placeholder="type a command…"
      />
    </div>
  </div>
</div>
{/if}

<style>
  .terminal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    z-index: 200;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
  }

  .terminal-window {
    width: 100%;
    max-width: 640px;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    border: 2px solid var(--c-ink);
    box-shadow: 6px 6px 0 var(--c-shadow);
    background-color: var(--c-bg);
    font-family: 'Space Grotesk', monospace;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 1rem;
    border-bottom: 2px solid var(--c-ink);
    background-color: var(--c-bg-alt);
  }

  .terminal-title {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--c-muted);
  }

  .terminal-close {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--c-muted);
    padding: 0 0.25rem;
    line-height: 1;
    transition: color 0.15s ease;
  }
  .terminal-close:hover { color: var(--c-ink); }

  .terminal-output {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-height: 200px;
  }

  .terminal-line {
    font-size: 0.8rem;
    line-height: 1.5;
    white-space: pre-wrap;
    word-break: break-word;
    margin: 0;
    color: var(--c-muted);
    font-family: inherit;
  }

  .terminal-line.is-cmd {
    color: var(--c-accent);
    font-weight: 700;
  }

  .terminal-input-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.65rem 1rem;
    border-top: 2px solid var(--c-ink);
  }

  .terminal-prompt {
    color: var(--c-accent);
    font-weight: 700;
    font-size: 0.9rem;
    line-height: 1;
  }

  .terminal-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    font-size: 0.8rem;
    font-family: inherit;
    color: var(--c-ink);
    caret-color: var(--c-accent);
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/Terminal.svelte
git commit -m "feat: add Terminal command palette with help/whoami/skills/experience/contact/achievements"
```

---

### Task 12: Wire Terminal to page + run all tests

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Add Terminal import**

In `src/routes/+page.svelte`, add after the existing imports:

```typescript
import Terminal from '$lib/components/Terminal.svelte';
```

- [ ] **Step 2: Add Terminal component to the template**

Just before `<svelte:window onkeydown={handleKeydown} />`, add:

```svelte
<Terminal bind:open={terminalOpen} />
```

- [ ] **Step 3: Run the full unit test suite**

```bash
pnpm test:unit -- --run
```
Expected: all tests PASS (at minimum: 7 gameState tests + 4 countUp tests).

- [ ] **Step 4: Start dev server and verify all features**

```bash
pnpm dev
```

Open the browser and check:
1. Stats in the hero animate up when visible (scroll down and back up in a new tab)
2. Clicking a skill tag triggers the stamp pop animation
3. Scroll progress bar fills as you scroll
4. Opening DevTools shows the console easter egg + hint
5. Pressing `/` opens the terminal; `Esc` closes it
6. `help`, `whoami`, `skills`, `experience`, `contact`, `achievements --list` all return output
7. `achievements --list` shows `terminal_found` as unlocked after opening the terminal
8. Clicking the portrait cycles through 4 visual modes
9. Scrolling to the very bottom reveals the footer secret
10. Toggling dark mode marks `dark_knight` as unlocked (verify via terminal)
11. Clicking the logo 5× quickly shows the tooltip message

- [ ] **Step 5: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: wire Terminal to page — gamification system complete"
```
