---
target: clicking logout has no visible effect
total_score: 18
max_score: 32
na_heuristics: 7,10
p0_count: 2
p1_count: 2
target_identity: "file:/workspaces/stravadash/src/components/AccountStatus.tsx"
target_fingerprint: "sha256:f67f9d55d44d8902c4b518cf430de222c032f1447438a9698e50ff9accc46cad"
target_path: /workspaces/stravadash/src/components/AccountStatus.tsx
timestamp: 2026-09-13T17-48-40Z
slug: src-components-accountstatus-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | No loading state on click; effect only surfaces via a coincidental query refetch on whichever route happens to be open |
| 2 | Match System / Real World | 3 | "Log out" is standard language, no issue |
| 3 | User Control and Freedom | 2 | Nothing tells the user whether a second click is safe or redundant |
| 4 | Consistency and Standards | 2 | Breaks the system's own stated rule: "state changes read as a deliberate switch flip" |
| 5 | Error Prevention | 3 | Low-risk action, no real prevention needed |
| 6 | Recognition Rather Than Recall | 3 | Single button, no memory burden |
| 7 | Flexibility and Efficiency | n/a | Not relevant to a one-shot action |
| 8 | Aesthetic and Minimalist Design | 3 | Visual styling itself is fine |
| 9 | Error Recovery | 1 | A failed /auth/logout POST is silently swallowed — no catch, no error UI |
| 10 | Help and Documentation | n/a | Not relevant |
| **Total** | | **18/32** | **Acceptable (56%)** |

## Design Specificity Verdict

**LLM assessment**: Not a generic "forgot a spinner" bug — it contradicts this product's own identity. DESIGN.md promises "state changes read as a deliberate switch flip," but the logout sequence is a silent async round-trip with zero intermediate state.

**Deterministic scan**: `impeccable detect` returned zero findings against AccountStatus.tsx, Shell.tsx, DataError.tsx. It flagged two unrelated advisory findings in StreakReadout.tsx (64px/88px font sizes off the DESIGN.md type ramp), out of scope here.

**Visual overlays**: Skipped — no browser automation tool exposed in this session. Substituted a mechanical static trace of the runtime sequence.

## Overall Impression

Root cause: nothing in this app reacts to "you're logged out" as a global fact. `logout()` removes only two query caches (`me`, `activities`) and hopes whatever route is mounted happens to read one of them. On `/` this mostly works coincidentally; on `/progress`, `/activities/$id`, `/coach` it doesn't, so nothing visibly changes until the user triggers an unrelated navigation — exactly the reported symptom.

## What's Working

- `DataError`'s 401-specific branch cleanly distinguishes "never connected" from "request failed."
- The button is already token-driven (`--radius-nav`, muted text, raised hover) — the fix is a state machine, not new visual design.

## Priority Issues

**[P0] No global signal that logout happened** — Why: direct cause of the reported bug; `removeQueries` only touches two keys, so routes reading neither show nothing until an unrelated navigation. Fix: `queryClient.clear()`/`resetQueries()` on logout, or make auth state reactive at `__root.tsx` so every route reacts uniformly. Suggested command: `/impeccable harden`

**[P0] No pending/loading state on the button** — Why: nothing on screen changes between click and fetch resolution; a second click can fire a duplicate POST. Fix: wrap in `useMutation`, disable + relabel while pending. Suggested command: `/impeccable animate`

**[P1] Logout POST failure is silently swallowed** — Why: no `response.ok` check, no try/catch, promise discarded via `void logout()`; a network failure leaves the user looking logged in with no trace but a console error. Fix: check response, catch, surface inline error. Suggested command: `/impeccable harden`

**[P1] Sidebar footer vanishes instantly with no transition** — Why: `return null` guard removes the button the instant `removeQueries` fires, contradicting the "deliberate switch flip" rule used everywhere else (nav, tabs). Fix: give the unmount a brief, deliberate exit state. Suggested command: `/impeccable animate`

**[P2] `navigate({ to: "/" })` is a no-op when already on `/`** — Why: the visible effect today comes entirely from cache-invalidation timing, not navigation, a race the code doesn't control. Fix: make query invalidation (fix #1) the actual source of truth for the UI update, not navigate. Suggested command: `/impeccable harden`

## Persona Red Flags

**Casey (impatient, thumb-only)**: clicks Log out, sees nothing change, assumes it didn't register, clicks again — two logout POSTs now in flight, no visible difference either way.

**Riley (stress-tester)**: primed by how deliberate every other state change in this app is; the silent collapse and route-dependent inconsistency reads as a bug specifically because everything else here is so precise.

## Minor Observations

- `meQuery` has no `staleTime`, so refetch is immediate once a route re-observes it — the problem is which routes get told to look again, not refetch speed.
- No positive "Logged out" confirmation exists anywhere; cheap P3 add once the above lands.

## Questions to Consider

- Should every async state-changing action route through one shared pending/disabled button primitive, given the "deliberate switch flip" promise is system-wide?
- Should `__root.tsx` make auth state a first-class, globally-reactive value instead of something each route incidentally observes through whichever queries it happens to fetch?
