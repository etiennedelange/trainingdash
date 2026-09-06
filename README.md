# Trainingdash

A gamified dashboard for your Strava activities, with live updates — an upload
appears on the dashboard about a second later, with no polling and no refresh.

## Stack

React 19 + TypeScript SPA (Vite) served by a single Cloudflare Worker that also
hosts the API and the Strava webhook. D1 stores activities; a Durable Object
holds the WebSocket connections that push updates to open tabs.

| Area | Choice |
|---|---|
| UI | React 19, TypeScript, Tailwind 4, Motion, Recharts |
| Data | TanStack Query, TanStack Router |
| Server | Cloudflare Worker (Hono), D1, Durable Object |
| App feel | PWA (`vite-plugin-pwa`) — installable, offline shell |
| Tests | Vitest (`@cloudflare/vitest-pool-workers`), Playwright |

## How live updates work

```
Strava ──webhook POST──▶ Worker /webhook ──200 OK (immediate)
                              │
                              └─ ctx.waitUntil:
                                   fetch activity from Strava API
                                   upsert into D1
                                   notify Durable Object
                                        │
Browser ◀──WebSocket broadcast─────────┘
```

Two Strava constraints shape this: the callback must return **200 within two
seconds**, and the event payload contains no activity data, so the activity has
to be fetched separately. The Worker therefore acknowledges first and does all
real work in `ctx.waitUntil()`.

The WebSocket is an optimisation, not the source of truth. The client refetches
on reconnect and on `visibilitychange`, so a dropped socket or a missed event
corrects itself.

## Setup

### 1. Strava application

Create one at <https://www.strava.com/settings/api>. Set the authorization
callback domain to `localhost` for development.

```bash
cp .dev.vars.example .dev.vars
# Fill in STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET.
# STRAVA_VERIFY_TOKEN: any random string.
# SESSION_SECRET: openssl rand -hex 32
```

### 2. Database

```bash
pnpm install
pnpm exec wrangler d1 create trainingdash   # copy the id into wrangler.jsonc
pnpm db:migrate:local
```

### 3. Run

```bash
pnpm dev     # http://localhost:5173 — SPA and Worker together
```

Open the app and click **Connect with Strava**. The full activity history
imports in the background.

### 4. Webhooks in development

Strava must reach your callback over public HTTPS, so expose the dev server:

```bash
cloudflared tunnel --url http://localhost:5173
node scripts/webhook.ts create https://<tunnel-host>/webhook
```

Strava allows exactly one subscription per application — use
`node scripts/webhook.ts list` and `... delete <id>` to manage it.

### 5. Deploy

```bash
pnpm exec wrangler secret put STRAVA_CLIENT_ID
pnpm exec wrangler secret put STRAVA_CLIENT_SECRET
pnpm exec wrangler secret put STRAVA_VERIFY_TOKEN
pnpm exec wrangler secret put SESSION_SECRET

# Point APP_URL in wrangler.jsonc at the deployed origin first, and set
# ALLOWED_ATHLETE_ID to your Strava athlete id so nobody else can connect.
# (Left empty, the first athlete to complete OAuth claims the instance.)
pnpm db:migrate:remote
pnpm deploy
node scripts/webhook.ts create https://<your-worker-host>/webhook
```

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` | Dev server (SPA + Worker + local D1) |
| `pnpm build` | Generate routes, typecheck, build |
| `pnpm test` | Worker unit tests against real workerd + D1 |
| `pnpm test:e2e` | Playwright end-to-end tests |
| `pnpm typecheck` | Types across app, worker, and tooling |
| `pnpm deploy` | Build and deploy to Cloudflare |

## Layout

```
worker/     Worker: routing, Strava client, D1 access, Durable Object, webhook
shared/     Types shared between Worker and client
src/        React SPA (routes, components, query + websocket hooks)
migrations/ D1 schema
scripts/    Strava webhook subscription management
e2e/        Playwright tests
```

## Status

The data pipeline is complete: OAuth, resumable backfill, webhook ingest, live
push, and one dashboard screen. The gamification layer — streaks, levels,
badges, goals, and the visual identity — is intentionally not built yet.
