# Stravadash — design

**Date:** 2026-09-05
**Status:** approved for planning
**Supersedes:** the stack table in `README.md` (which describes code no longer in the tree)

## 1. What this is

A single-athlete exercise dashboard over the Strava API. An upload to Strava
appears on the dashboard about a second later, with no polling and no refresh.

**In scope:** Strava OAuth, full history backfill, webhook ingest, live push to
open tabs, an aggregate dashboard, route maps, installable PWA, optional push
notification on activity arrival, and a Coach chat answering questions about
recent training.

**Out of scope, deliberately:**

- **Multi-user.** Single-athlete by design, not merely unbuilt. One athlete id
  is allowed to connect; everyone else is refused.
- **Gamification and visual identity.** Streaks, levels, badges, goals and the
  design language get their own brainstorm once this pipeline is proven. This
  spec builds the data and one plain dashboard screen to hang them on.
- **Strength training and muscle-group tagging.** The design artifact has a
  Strength screen with user-entered muscle-group tags. Strava has no such data,
  so it would need a writable table and write endpoints. Cut for now — the
  Worker stays read-only apart from push subscriptions.

## 2. Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Routing | TanStack Router |
| Server cache | TanStack Query |
| UI | Tailwind 4, shadcn/ui |
| Animation | Motion |
| Charts | Apache ECharts (`echarts/core`, thin local React hook) |
| Maps | MapLibre GL |
| App feel | `vite-plugin-pwa` — installable, offline shell |
| Notifications | Web Push (VAPID) |
| Coach | Anthropic API (`@anthropic-ai/sdk`, `claude-opus-5`), streamed |
| Server | Cloudflare Worker (Hono) — serves SPA, API and webhook |
| Database | Cloudflare D1 |
| Live transport | Durable Object with WebSocket Hibernation |
| Tests | Vitest + `@cloudflare/vitest-pool-workers`, Playwright |

### Why Cloudflare rather than Supabase + Vercel

Three arguments decided it.

**Nothing sleeps.** The webhook must answer Strava within two seconds and may
sit idle for weeks between training blocks. Workers are V8 isolates with no
meaningful cold start and no free-tier project pausing. "Is the backend awake?"
is not a question this endpoint should ever raise.

**One origin, one deploy.** A single `wrangler deploy` ships the SPA, the API
and `/webhook` to one hostname: no CORS, no cross-origin cookie handling, one
secret store, one log stream.

**Postgres wins little at this scale.** A lifetime history is a few thousand
activities — single-digit megabytes. Aggregation happens in TypeScript over
rows already in memory, where it is readable and unit-testable, so
`date_trunc` and `generate_series` buy nothing. Storing a precomputed
`local_date` at ingest removes SQLite's one real weakness.

The cost accepted: no Postgres if the single-athlete assumption ever breaks,
and the WebSocket fan-out is hand-written rather than managed. Both are
understood and accepted; the second is also a stated learning goal.

**Rejected:** Vercel frontend with a Cloudflare backend. It pays the two-origin
tax *and* forfeits Cloudflare's single-deploy advantage.

## 3. Architecture

One Worker is the whole server.

```
                    ┌──────────────────────── Cloudflare ─────────────────────────┐
                    │                                                             │
Browser ───────────▶│  Worker (Hono)                                              │
  SPA + API + WS    │   ├── assets binding ──▶ built SPA (index.html fallback)     │
                    │   ├── /api/*          ──▶ JSON, session-cookie guarded      │
                    │   ├── /auth/*         ──▶ Strava OAuth                      │
                    │   ├── /webhook        ──▶ Strava events                     │
                    │   └── /live           ──▶ upgrade, forwarded to the DO       │
                    │                                                             │
                    │  D1 ── athlete, activities, sync_state, push_subscriptions   │
                    │  DO "live" ── holds hibernating WebSockets, broadcasts        │
                    └─────────────────────────────────────────────────────────────┘
```

Modules, each independently testable:

| Module | Responsibility | Depends on |
|---|---|---|
| `worker/routes/*` | HTTP surface, validation, auth guard | services |
| `worker/strava/client.ts` | Strava HTTP, token refresh, rate-limit headers | fetch, token store |
| `worker/strava/oauth.ts` | Code exchange, athlete gate | client, D1 |
| `worker/db/*` | Typed D1 queries; no business logic | D1 |
| `worker/sync/backfill.ts` | Resumable history import | client, D1 |
| `worker/sync/ingest.ts` | One webhook event → one row change | client, D1, DO |
| `worker/live/room.ts` | Durable Object; connections and broadcast | — |
| `worker/coach/digest.ts` | Builds the training digest sent to Claude | D1, aggregate |
| `worker/coach/chat.ts` | Anthropic streaming call | Anthropic SDK |
| `shared/aggregate.ts` | Pure functions: rows in, dashboard stats out | nothing |
| `shared/types.ts` | Types crossing the Worker/client boundary | — |

`shared/aggregate.ts` depending on nothing is deliberate: it is where the
gamification layer will later grow, and it stays a pure-function unit test.

## 4. Data flow

### 4.1 Connect

1. `GET /auth/login` → redirect to Strava, scope `activity:read_all`.
2. `GET /auth/callback?code=` → exchange for tokens.
3. **Athlete gate.** If `ALLOWED_ATHLETE_ID` is set and the returned athlete id
   differs, refuse and store nothing. If unset, the first athlete to complete
   OAuth claims the instance and their id is written to `athlete`.
4. Store access token, refresh token and expiry in D1.
5. Set a signed session cookie: `HttpOnly`, `Secure`, `SameSite=Lax`.
6. Enqueue backfill via `ctx.waitUntil`, redirect to `/`.

Access tokens are short-lived. The Strava client refreshes on expiry and
persists the new pair; a refresh failure marks the athlete disconnected and the
UI shows a reconnect prompt.

### 4.2 Backfill

`GET /athlete/activities` paged newest-first at `per_page=200`. After each page
the last processed page and activity id are written to `sync_state`, so an
interrupted run resumes rather than restarts.

Strava enforces both a rolling 15-minute and a daily request cap; the exact
figures depend on the application's tier and must be read off the app's API
settings page rather than assumed. The client therefore reads the
`X-RateLimit-Usage` / `X-RateLimit-Limit` response headers and, on approaching
the limit or on a 429, stops and records the resume point instead of retrying
in a loop. A scheduled Worker trigger resumes an incomplete backfill.

Backfill writes are `INSERT ... ON CONFLICT(id) DO UPDATE`, so re-running is
safe.

### 4.3 Live ingest

```
Strava ──POST /webhook──▶ Worker ──200 OK immediately (< 2s)
                            │
                            └─ ctx.waitUntil:
                                 GET /activities/{id}   (event carries no data)
                                 upsert into D1
                                 DO.fetch("/broadcast", {type, activity})
                                      │
Browser ◀── WebSocket ────────────────┘
```

Two Strava constraints shape this and are the reason for the shape:

- The callback must return 200 within two seconds, so the handler acknowledges
  before doing any work.
- The event payload contains no activity data. The documented fields are
  `object_type`, `object_id`, `aspect_type`, `updates`, `owner_id`,
  `subscription_id` and `event_time` — ids and a change hash, nothing else —
  so the activity must be fetched separately.

`aspect_type` maps to: `create`/`update` → fetch and upsert; `delete` → delete
the row. Events whose `owner_id` is not the allowed athlete are acknowledged
and dropped.

Subscription validation is a separate `GET /webhook?hub.mode=subscribe&
hub.verify_token=…&hub.challenge=…`. When `hub.verify_token` matches
`STRAVA_VERIFY_TOKEN`, respond 200 within two seconds with the challenge
echoed **as JSON**: `{"hub.challenge": "<value>"}`. Strava's own
troubleshooting names a slow or malformed response here as the most common
cause of subscription creation failing, so this path is covered by a Worker
test rather than discovered by hand.

### 4.4 Live push

A single Durable Object instance, reached with `env.LIVE.getByName("live")`.
`GET /live` upgrades and hands the socket to the DO, which calls
`this.ctx.acceptWebSocket(server)` rather than `ws.accept()`. That is what
makes the connection hibernatable: the object can be evicted from memory while
the socket stays open, and the runtime reconstructs it to deliver a message.
Messages arrive at `webSocketMessage`, closes at `webSocketClose`; connected
sockets are enumerated with `this.ctx.getWebSockets()`, which is how
`/broadcast` fans out.

Keepalives use `this.ctx.setWebSocketAutoResponse(new
WebSocketRequestResponsePair("ping", "pong"))`, so heartbeat traffic is
answered by the runtime **without waking the object** — a client can hold the
socket open indefinitely at no duration cost.

Set `compatibility_date` to at least `2026-04-07` to get
`web_socket_auto_reply_to_close`, under which the runtime replies to Close
frames itself.

**The socket is an optimisation, not the source of truth.** The client refetches
on reconnect and on `visibilitychange`, so a dropped socket, a missed event or
a failed fetch inside `waitUntil` self-corrects the next time the tab is
looked at. This is what keeps a lost event from being a lost activity, and it
is why the DO needs no persistence or replay.

### 4.5 Notification

If the user has granted permission and a push subscription is stored, ingest
also sends a Web Push message via VAPID. Failure here is logged and ignored —
it must never affect the D1 write or the broadcast. On iOS, push requires the
PWA to have been installed to the home screen; the UI states this rather than
silently failing.

### 4.6 Coach

`POST /api/coach` takes the conversation so far and streams back a reply.

```
Client ──{messages}──▶ Worker /api/coach
                          │  session cookie required
                          ├─ read last 30 days from D1
                          ├─ shared/aggregate.ts → training digest
                          └─ Anthropic Messages API (streaming)
Client ◀──── SSE ─────────┘
```

**The digest is built server-side, never sent by the client.** The request body
carries only the conversation turns; the Worker reads D1 itself and composes
the digest. A client-supplied digest would let the page assert whatever
training history it liked, and would make the endpoint a general-purpose relay
to a paid API.

Request shape:

- `model: "claude-opus-5"`.
- `thinking: { type: "adaptive" }`. `budget_tokens` is **removed** on Opus 5
  and returns a 400 — it must not appear in the code.
- `output_config: { effort: "medium" }`. Chat is not a workload that repays
  high effort; this is the first cost lever to turn down if the bill matters.
- **Streaming**, so a long answer cannot hit an HTTP timeout and the UI can
  render tokens as they arrive.
- `max_tokens: 16000`. Answers are conversational and deliberately short; this
  is a ceiling, not a target.
- No assistant prefill — it returns a 400 on Opus 5. Response shape is steered
  by the system prompt.

**Prompt caching does real work here.** The request renders as
`tools → system → messages`, and a cache breakpoint is a prefix match, so the
stable coaching instructions and the training digest go in `system` with
`cache_control: { type: "ephemeral" }`, and only the varying question sits
after it. Every follow-up turn in a conversation then reads the digest from
cache instead of paying for it again. The digest must therefore be
**deterministic** — sorted keys, no `Date.now()`, no per-request ids — or the
cache silently never hits. `usage.cache_read_input_tokens` staying at zero
across a multi-turn conversation is the signal that something volatile crept
into the prefix.

No tool use. The digest is computed before the call, so Claude needs no
database access, which keeps the endpoint a single request rather than an
agent loop.

**This is the project's only paid dependency and its only outbound API key.**
`ANTHROPIC_API_KEY` is a Worker secret, the route is behind the session cookie,
and the single-athlete gate means only you can spend it.

## 5. Data model (D1)

```sql
CREATE TABLE athlete (
  id            INTEGER PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  connected     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE activities (
  id             INTEGER PRIMARY KEY,
  name           TEXT    NOT NULL,
  sport_type     TEXT    NOT NULL,
  start_date     TEXT    NOT NULL,  -- UTC ISO 8601
  local_date     TEXT    NOT NULL,  -- YYYY-MM-DD in the athlete's local tz
  elapsed_time   INTEGER NOT NULL,
  moving_time    INTEGER NOT NULL,
  distance       REAL    NOT NULL,
  total_elevation_gain REAL,
  average_speed  REAL,
  average_heartrate REAL,
  suffer_score   INTEGER,
  polyline       TEXT,               -- summary_polyline, encoded
  raw            TEXT    NOT NULL,   -- full JSON, for fields added later
  updated_at     INTEGER NOT NULL
);
CREATE INDEX activities_local_date ON activities(local_date);
CREATE INDEX activities_sport_type ON activities(sport_type);

CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,   -- 'backfill'
  value TEXT NOT NULL       -- JSON: { page, complete, last_error }
);

CREATE TABLE push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  keys     TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

`local_date` is computed once at ingest. It is what makes day- and week-bucketed
queries trivial in SQLite and is the mitigation for the absent `date_trunc`.

`raw` is kept so a new dashboard field never requires a re-backfill. It is
never sent to the client.

### Where aggregation runs

**In the browser.** `GET /api/activities` returns every activity as a slim row
— the columns above minus `raw` and `polyline`, a few hundred bytes each, so
low single-digit megabytes for a lifetime history. TanStack Query caches that
one response and `shared/aggregate.ts` runs over it in the browser.

This is why there is no `/api/stats`. Filtering by sport, date range or
distance becomes a synchronous recomputation with no network round trip, which
is what makes a dashboard feel fast; the same pure functions stay trivially
unit-testable; and the gamification layer later grows in one place that needs
no new endpoints. The Worker stays a thin data pipe. Should the dataset ever
outgrow this — it will not at single-athlete scale — the same functions can be
moved server-side unchanged, which is the reason they live in `shared/`.

## 6. API surface

| Route | Purpose |
|---|---|
| `GET /auth/login` | Redirect to Strava |
| `GET /auth/callback` | Code exchange, athlete gate, session |
| `POST /auth/logout` | Clear session |
| `GET /api/me` | Athlete, connection state, backfill progress |
| `GET /api/activities` | Every activity as a slim row (no `raw`), for the client cache |
| `GET /api/activities/:id` | One activity in full, including polyline |
| `POST /api/coach` | Coach chat; streams the reply |
| `POST /api/push/subscribe` | Store a push subscription |
| `GET /live` | WebSocket upgrade |
| `GET /webhook` | Subscription validation |
| `POST /webhook` | Event receipt |

Everything under `/api` and `/live` requires the session cookie. `/webhook` is
unauthenticated by necessity and is guarded by `STRAVA_VERIFY_TOKEN` plus the
`owner_id` check.

## 7. Frontend

```
src/
  routes/         TanStack Router file routes
  components/     shadcn/ui primitives plus app components
  charts/         useEChart hook and chart components
  map/            MapLibre route map, polyline decode
  hooks/          useLiveUpdates (WebSocket + refetch-on-visibility)
  lib/            query client, api client
```

**ECharts is imported from `echarts/core`** with explicit chart and component
registration, wrapped in a local `useEChart` hook — roughly thirty lines
holding an instance in a ref, sizing it with a `ResizeObserver`, and disposing
on unmount. The `echarts-for-react` wrapper is deliberately avoided: it is
community-maintained and has historically lagged React major versions, and
tree-shaking matters more here than the convenience.

**The charts in the design artifact are not canonical.** They are bar rows and
progress rings that happen to be easy to draw; chart form is chosen per view on
the merits. ECharts earns its place where interaction or density justify it —
the calendar heatmap, the multi-week distance series — and a plain SVG or CSS
bar is the right answer for a four-row workout-mix breakdown. Neither choice is
settled by what the comp happens to show.

**MapLibre needs a tile source**, which it does not provide. OpenFreeMap or
Protomaps, both usable without an account, are the candidates; the choice is
made when the map is built and does not affect anything else.

`useLiveUpdates` owns the socket: connect, exponential-backoff reconnect,
invalidate the relevant TanStack Query keys on a message, and refetch on
`visibilitychange`. No component talks to the socket directly.

## 8. Error handling

| Failure | Behaviour |
|---|---|
| Webhook handler throws | 200 was already sent; error logged, event lost, recovered by the next client refetch |
| Strava fetch fails in ingest | Logged; row unchanged; corrected on next refetch or a later update event |
| Rate limit hit during backfill | Resume point saved, run stops, scheduled trigger continues later |
| Refresh token rejected | `connected = 0`, UI shows reconnect |
| WebSocket drops | Backoff reconnect; refetch on reconnect closes the gap |
| Wrong athlete completes OAuth | Refused, nothing stored |
| Push send fails | Logged and ignored |
| Coach call fails or is rate-limited | Typed SDK errors caught most-specific-first; the chat shows the failure and keeps the conversation, nothing else is affected |

The through-line: **no failure path is allowed to be silently
unrecoverable.** Every one either self-heals on the next refetch or surfaces in
`GET /api/me`.

## 9. Testing

- **`shared/aggregate.ts`** — plain Vitest. Pure functions over fixture rows.
  The densest tests in the project, because this is where the logic lives and
  where gamification will later grow.
- **Worker** — `@cloudflare/vitest-pool-workers`, running against real workerd
  and a real local D1. Covers routing, the auth guard, token refresh, ingest
  upsert and delete, the athlete gate, and webhook validation.
- **Durable Object** — connect two sockets, broadcast, assert both receive;
  assert hibernation resumption.
- **Backfill** — a fake Strava returning paged fixtures plus a 429, asserting
  the run resumes from the saved point rather than restarting.
- **Coach** — `worker/coach/digest.ts` is a pure function and unit-tested on
  fixtures, including a **determinism test**: the same rows must produce a
  byte-identical digest, since prompt caching depends on it. The Anthropic call
  is stubbed; no test spends money.
- **Playwright** — connect flow against a stubbed Strava, dashboard render,
  and a live-update test that posts a webhook event and asserts the DOM
  updates without a reload.

## 10. Configuration

Static assets are served by the Worker itself:

```jsonc
"assets": {
  "directory": "./dist",
  "binding": "ASSETS",
  "not_found_handling": "single-page-application",
  "run_worker_first": ["/*", "!/assets/*"]
}
```

`not_found_handling` returns `index.html` for client-side routes, which
TanStack Router needs. `run_worker_first` sends everything through the Worker
except Vite's hashed `/assets/*` bundles, which are served directly — so
`/api`, `/auth`, `/webhook` and `/live` reach Hono while static files skip it.
A Worker may configure only one asset collection.

Bindings: `DB` (D1), `LIVE` (Durable Object), `ASSETS`, plus
vars `APP_URL` and `ALLOWED_ATHLETE_ID`. A cron trigger (hourly) drives the
`scheduled` handler that resumes an incomplete backfill after a rate-limit
stop; it is a no-op once `sync_state.backfill` is marked complete.

Secrets: `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`,
`SESSION_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `ANTHROPIC_API_KEY`. Locally these live
in `.dev.vars`, which is gitignored and already present.

Development webhooks need a public HTTPS URL, so `cloudflared tunnel --url
http://localhost:5173` fronts the dev server. Strava permits exactly one
subscription per application, so `scripts/webhook.ts` provides
`create`/`list`/`delete`.

## 11. Consequences

- `README.md` is rewritten: its current stack table and setup steps describe
  code that is not in the tree.
- `package.json` dependency fields are repopulated. `pnpm-lock.yaml` already
  pins React 19, TanStack Router/Query, Hono, Motion and Tailwind; ECharts,
  MapLibre GL and the shadcn/ui primitives are additions, and `recharts` is
  dropped.
- `pnpm-workspace.yaml` already allowlists the `workerd` build script.

## 12. Verification status

Checked against current vendor documentation on 2026-09-05:

- **Verified.** Strava's two-second response deadline (both the POST callback
  and the GET validation), the event payload field list, one active
  subscription per application, the JSON `hub.challenge` echo. Cloudflare's
  `assets` binding with `not_found_handling` and `run_worker_first`, the
  Durable Object Hibernation API (`acceptWebSocket`, `webSocketMessage`,
  `getWebSockets`, `setWebSocketAutoResponse`), and that hibernation avoids
  billing for idle connections. Supabase's `EdgeRuntime.waitUntil` — checked
  while comparing platforms, now moot.
- **Not verified, confirm before relying on it.** Workers and D1 free-tier
  quotas. Whether `echarts-for-react` currently supports React 19 — the spec
  avoids it regardless, so this only matters if you would rather not
  hand-roll the hook. That MapLibre needs a third-party tile source, and that
  OpenFreeMap and Protomaps are usable without an account. That iOS requires
  home-screen installation before Web Push works. Strava's current rate-limit
  figures, which depend on your application's tier and are deliberately absent
  from this document — read them off <https://www.strava.com/settings/api>.
- **Coach request shape** taken from the bundled `claude-api` reference rather
  than recalled: `claude-opus-5`, adaptive thinking, `output_config.effort`,
  no `budget_tokens`, no prefill. Confirm current pricing before assuming a
  monthly cost.

## 13. Deferred

The gamification layer — streaks, levels, badges, goals — the Strength screen
and its muscle-group tagging (which needs the writable table cut from §1), and
the visual identity, including the design direction in the referenced
artifact. These get
their own brainstorm against `shared/aggregate.ts` once activities are flowing.
The dashboard built here is a placeholder, not the design language.
