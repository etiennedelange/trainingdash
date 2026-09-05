# Stravadash Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strava activities flow into D1 — by OAuth, by resumable backfill, and by webhook — and a connected browser receives each change over a WebSocket within about a second.

**Architecture:** One Cloudflare Worker (Hono) serves the API and the Strava webhook. D1 stores activities. A single Durable Object holds hibernating WebSockets and broadcasts changes. The webhook acknowledges within two seconds and does all real work in `ctx.waitUntil()`.

**Tech Stack:** TypeScript, Hono, Cloudflare Workers/D1/Durable Objects, Vite, Vitest with `@cloudflare/vitest-pool-workers`, pnpm 11.

**Spec:** `docs/superpowers/specs/2026-09-05-stravadash-design.md`

**Plan 1 of 3.** Plan 2 is the dashboard SPA (`shared/aggregate.ts`, routes, charts, map, PWA). Plan 3 is the Coach endpoint. Both depend on this one. Neither is in scope here.

## Global Constraints

- **Single athlete.** `ALLOWED_ATHLETE_ID` gates OAuth. If unset, the first athlete to complete OAuth claims the instance. Never store a second athlete.
- **Worker is read-only to the client.** No user-writable tables in this plan. (Push subscriptions arrive in Plan 2, the Coach in Plan 3.)
- **Webhook must return 200 within two seconds** — both `GET` validation and `POST` events. Never `await` Strava or D1 before responding.
- **`compatibility_date` must be `2026-04-07` or later**, for `web_socket_auto_reply_to_close`.
- **Never hardcode Strava rate-limit numbers.** Read `X-RateLimit-Limit` / `X-RateLimit-Usage` off responses. The account's actual caps live at <https://www.strava.com/settings/api>.
- **TypeScript is strict**, with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `verbatimModuleSyntax` (see `tsconfig.app.json`). Indexed access yields `T | undefined` — handle it, never `!`.
- **pnpm 11 supply-chain rules** in `pnpm-workspace.yaml` are authoritative: `minimumReleaseAge: 1440` refuses packages published in the last 24h, and `strictDepBuilds` makes an unapproved build script a hard install failure. `workerd`, `esbuild` and `@tailwindcss/oxide` are already allowlisted; adding a dependency with a build script means adding it to `allowBuilds` with a justifying comment.
- **No secrets in git.** `.dev.vars` is gitignored and already holds `STRAVA_CLIENT_ID`, `STRAVA_CLIENT_SECRET`, `STRAVA_VERIFY_TOKEN`, `SESSION_SECRET`.
- **Commit after every task.**

## File Structure

| File | Responsibility |
|---|---|
| `wrangler.jsonc` | Worker config: D1, DO, assets, cron, vars |
| `vite.config.ts` | SPA build to `dist/` |
| `vitest.config.ts` | Worker tests against real workerd + D1 |
| `tsconfig.worker.json`, `tsconfig.node.json` | Project references already declared in `tsconfig.json` |
| `migrations/0001_init.sql` | D1 schema |
| `shared/types.ts` | Types crossing the Worker/client boundary |
| `worker/index.ts` | Hono app, route mounting, `scheduled` handler, DO export |
| `worker/env.ts` | `Env` binding types |
| `worker/session.ts` | Signed session cookie (HMAC-SHA256, WebCrypto) |
| `worker/db/athlete.ts` | Athlete row + token persistence |
| `worker/db/activities.ts` | Activity upsert / delete / read |
| `worker/db/sync.ts` | Backfill resume state |
| `worker/strava/types.ts` | Strava API response shapes |
| `worker/strava/client.ts` | HTTP, token refresh, rate-limit headers |
| `worker/strava/oauth.ts` | Authorize URL, code exchange, athlete gate |
| `worker/strava/map.ts` | `StravaActivity` → `ActivityRow` |
| `worker/sync/backfill.ts` | Resumable history import |
| `worker/sync/ingest.ts` | One webhook event → one row change |
| `worker/live/room.ts` | Durable Object: connections and broadcast |
| `worker/routes/auth.ts` | `/auth/*` |
| `worker/routes/api.ts` | `/api/*` |
| `worker/routes/webhook.ts` | `/webhook` |
| `scripts/webhook.ts` | Subscription create/list/delete |

---

### Task 1: Scaffolding — Worker, config, and a green test loop

**Files:**
- Create: `wrangler.jsonc`, `vite.config.ts`, `vitest.config.ts`, `tsconfig.worker.json`, `tsconfig.node.json`, `worker/env.ts`, `worker/index.ts`, `src/main.tsx`
- Modify: `package.json`
- Test: `worker/index.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Env` (binding types), a Hono app default-exported from `worker/index.ts`, and a working `pnpm test`.

- [ ] **Step 1: Install dependencies**

```bash
cd /workspaces/stravadash
pnpm add hono react react-dom @tanstack/react-query @tanstack/react-router
pnpm add -D typescript vite @vitejs/plugin-react wrangler vitest \
  @cloudflare/vitest-pool-workers @cloudflare/workers-types \
  @types/react @types/react-dom
```

If install fails with a `minimumReleaseAge` error, a package published in the last 24h is being resolved. Pin to the previous patch release rather than lowering the threshold.

- [ ] **Step 2: Write `wrangler.jsonc`**

```jsonc
{
  "name": "stravadash",
  "main": "worker/index.ts",
  "compatibility_date": "2026-07-16",
  "compatibility_flags": ["nodejs_compat"],
  "assets": {
    "directory": "./dist",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/*", "!/assets/*"]
  },
  "d1_databases": [
    { "binding": "DB", "database_name": "stravadash", "database_id": "PLACEHOLDER", "migrations_dir": "migrations" }
  ],
  "durable_objects": {
    "bindings": [{ "name": "LIVE", "class_name": "LiveRoom" }]
  },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["LiveRoom"] }],
  "triggers": { "crons": ["0 * * * *"] },
  "vars": { "APP_URL": "http://localhost:5173", "ALLOWED_ATHLETE_ID": "" }
}
```

`database_id` stays `PLACEHOLDER` until Step 8.

- [ ] **Step 3: Write the config files**

`tsconfig.worker.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "paths": { "#shared/*": ["./shared/*"] }
  },
  "include": ["worker", "shared"]
}
```

`tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "vitest.config.ts", "scripts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "#shared": path.resolve(import.meta.dirname, "./shared"),
    },
  },
  build: { outDir: "dist" },
});
```

`vitest.config.ts`:

```ts
import { defineWorkersConfig } from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig({
  test: {
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: { compatibilityFlags: ["nodejs_compat"] },
      },
    },
  },
});
```

- [ ] **Step 4: Write `worker/env.ts`**

```ts
export interface Env {
  DB: D1Database;
  LIVE: DurableObjectNamespace;
  ASSETS: Fetcher;
  APP_URL: string;
  ALLOWED_ATHLETE_ID: string;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_VERIFY_TOKEN: string;
  SESSION_SECRET: string;
}
```

- [ ] **Step 5: Write the failing test**

`worker/index.test.ts`:

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker", () => {
  it("answers the health check", async () => {
    const res = await SELF.fetch("http://example.com/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("has its bindings", () => {
    expect(env.DB).toBeDefined();
    expect(env.LIVE).toBeDefined();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `pnpm exec vitest run worker/index.test.ts`
Expected: FAIL — no `worker/index.ts` module, or 404 on `/api/health`.

- [ ] **Step 7: Write the minimal Worker and SPA entry**

`worker/index.ts`:

```ts
import { Hono } from "hono";
import type { Env } from "./env";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));

export default app;
```

`src/main.tsx` (placeholder so `vite build` succeeds; Plan 2 replaces it):

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

const el = document.getElementById("root");
if (el) createRoot(el).render(<StrictMode><h1>Stravadash</h1></StrictMode>);
```

- [ ] **Step 8: Create the D1 database and record its id**

```bash
pnpm exec wrangler d1 create stravadash
```

Copy the printed `database_id` into `wrangler.jsonc`, replacing `PLACEHOLDER`.

- [ ] **Step 9: Add scripts to `package.json`**

```json
"scripts": {
  "dev": "vite",
  "build": "tsc -b && vite build",
  "test": "vitest run",
  "typecheck": "tsc -b",
  "db:migrate:local": "wrangler d1 migrations apply stravadash --local",
  "db:migrate:remote": "wrangler d1 migrations apply stravadash --remote",
  "deploy": "pnpm build && wrangler deploy"
}
```

- [ ] **Step 10: Run the test to verify it passes**

Run: `pnpm test`
Expected: PASS, 2 tests.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: scaffold Worker, D1, and the test harness"
```

---

### Task 2: D1 schema and the typed data layer

**Files:**
- Create: `migrations/0001_init.sql`, `shared/types.ts`, `worker/db/activities.ts`, `worker/db/athlete.ts`, `worker/db/sync.ts`
- Test: `worker/db/activities.test.ts`, `worker/db/athlete.test.ts`, `worker/db/sync.test.ts`
- Create: `worker/test/apply-migrations.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `Env` from Task 1.
- Produces:
  - `ActivityRow`, `AthleteRecord`, `BackfillState` (in `shared/types.ts`)
  - `upsertActivity(db: D1Database, row: ActivityRow): Promise<void>`
  - `deleteActivity(db: D1Database, id: number): Promise<void>`
  - `getActivity(db: D1Database, id: number): Promise<ActivityRow | null>`
  - `listActivities(db: D1Database): Promise<ActivityRow[]>`
  - `getAthlete(db: D1Database): Promise<AthleteRecord | null>`
  - `saveAthlete(db: D1Database, rec: AthleteRecord): Promise<void>`
  - `setConnected(db: D1Database, id: number, connected: boolean): Promise<void>`
  - `getBackfillState(db: D1Database): Promise<BackfillState>`
  - `setBackfillState(db: D1Database, s: BackfillState): Promise<void>`

- [ ] **Step 1: Write the migration**

`migrations/0001_init.sql`:

```sql
CREATE TABLE athlete (
  id            INTEGER PRIMARY KEY,
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    INTEGER NOT NULL,
  connected     INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE activities (
  id                   INTEGER PRIMARY KEY,
  name                 TEXT    NOT NULL,
  sport_type           TEXT    NOT NULL,
  start_date           TEXT    NOT NULL,
  local_date           TEXT    NOT NULL,
  elapsed_time         INTEGER NOT NULL,
  moving_time          INTEGER NOT NULL,
  distance             REAL    NOT NULL,
  total_elevation_gain REAL,
  average_speed        REAL,
  average_heartrate    REAL,
  suffer_score         INTEGER,
  polyline             TEXT,
  raw                  TEXT    NOT NULL,
  updated_at           INTEGER NOT NULL
);
CREATE INDEX activities_local_date ON activities(local_date);
CREATE INDEX activities_sport_type ON activities(sport_type);

CREATE TABLE sync_state (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

The spec's `push_subscriptions` table is deliberately **not** here. Nothing in
this plan writes or reads it; it arrives as `migrations/0002_push.sql` in Plan 2
alongside the code that uses it. Adding an unused table now would ship schema
no test exercises.

- [ ] **Step 2: Wire migrations into the test harness**

`worker/test/apply-migrations.ts`:

```ts
import { applyD1Migrations, env } from "cloudflare:test";

await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
```

In `vitest.config.ts`, add a setup file and expose the migrations to the test env:

```ts
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";
import path from "node:path";

const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

export default defineWorkersConfig({
  test: {
    setupFiles: ["./worker/test/apply-migrations.ts"],
    poolOptions: {
      workers: {
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          compatibilityFlags: ["nodejs_compat"],
          bindings: { TEST_MIGRATIONS: migrations },
        },
      },
    },
  },
});
```

Create `worker/test/env.d.ts` so `cloudflare:test` knows what `env` holds. The
`import` makes this a module, which is what turns the `declare module` block
into an augmentation rather than a redefinition:

```ts
import type { Env } from "../env";

declare module "cloudflare:test" {
  interface ProvidedEnv extends Env {
    TEST_MIGRATIONS: D1Migration[];
  }
}
```

- [ ] **Step 3: Write `shared/types.ts`**

```ts
export interface ActivityRow {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  local_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  suffer_score: number | null;
  polyline: string | null;
  raw: string;
  updated_at: number;
}

export interface AthleteRecord {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  connected: boolean;
}

export interface BackfillState {
  page: number;
  complete: boolean;
  last_error: string | null;
}
```

- [ ] **Step 4: Write the failing tests**

`worker/db/activities.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { upsertActivity, deleteActivity, getActivity, listActivities } from "./activities";
import type { ActivityRow } from "#shared/types";

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: 1, name: "Evening Run", sport_type: "Run",
  start_date: "2026-09-05T18:41:00Z", local_date: "2026-09-05",
  elapsed_time: 2052, moving_time: 2052, distance: 6420,
  total_elevation_gain: 48, average_speed: 3.13, average_heartrate: 152,
  suffer_score: 40, polyline: "abc", raw: "{}", updated_at: 1,
  ...over,
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM activities").run();
});

describe("activities", () => {
  it("inserts and reads back a row", async () => {
    await upsertActivity(env.DB, row());
    expect((await getActivity(env.DB, 1))?.name).toBe("Evening Run");
  });

  it("updates on conflict rather than duplicating", async () => {
    await upsertActivity(env.DB, row());
    await upsertActivity(env.DB, row({ name: "Renamed", updated_at: 2 }));
    const all = await listActivities(env.DB);
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("Renamed");
  });

  it("deletes", async () => {
    await upsertActivity(env.DB, row());
    await deleteActivity(env.DB, 1);
    expect(await getActivity(env.DB, 1)).toBeNull();
  });

  it("lists newest first", async () => {
    await upsertActivity(env.DB, row({ id: 1, local_date: "2026-09-01" }));
    await upsertActivity(env.DB, row({ id: 2, local_date: "2026-09-05" }));
    expect((await listActivities(env.DB)).map((a) => a.id)).toEqual([2, 1]);
  });
});
```

`worker/db/athlete.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getAthlete, saveAthlete, setConnected } from "./athlete";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM athlete").run();
});

describe("athlete", () => {
  it("returns null when nobody has connected", async () => {
    expect(await getAthlete(env.DB)).toBeNull();
  });

  it("saves and reads back, mapping connected to a boolean", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    const a = await getAthlete(env.DB);
    expect(a?.id).toBe(42);
    expect(a?.connected).toBe(true);
  });

  it("marks disconnected", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    await setConnected(env.DB, 42, false);
    expect((await getAthlete(env.DB))?.connected).toBe(false);
  });
});
```

`worker/db/sync.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getBackfillState, setBackfillState } from "./sync";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM sync_state").run();
});

describe("sync state", () => {
  it("defaults to page 1, incomplete", async () => {
    expect(await getBackfillState(env.DB)).toEqual({ page: 1, complete: false, last_error: null });
  });

  it("round-trips", async () => {
    await setBackfillState(env.DB, { page: 4, complete: false, last_error: "rate limited" });
    expect(await getBackfillState(env.DB)).toEqual({ page: 4, complete: false, last_error: "rate limited" });
  });
});
```

- [ ] **Step 5: Run the tests to verify they fail**

Run: `pnpm exec vitest run worker/db`
Expected: FAIL — modules `./activities`, `./athlete`, `./sync` not found.

- [ ] **Step 6: Write the implementations**

`worker/db/activities.ts`:

```ts
import type { ActivityRow } from "#shared/types";

const COLUMNS = `id, name, sport_type, start_date, local_date, elapsed_time,
  moving_time, distance, total_elevation_gain, average_speed, average_heartrate,
  suffer_score, polyline, raw, updated_at`;

export async function upsertActivity(db: D1Database, row: ActivityRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO activities (${COLUMNS})
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, sport_type=excluded.sport_type,
         start_date=excluded.start_date, local_date=excluded.local_date,
         elapsed_time=excluded.elapsed_time, moving_time=excluded.moving_time,
         distance=excluded.distance, total_elevation_gain=excluded.total_elevation_gain,
         average_speed=excluded.average_speed, average_heartrate=excluded.average_heartrate,
         suffer_score=excluded.suffer_score, polyline=excluded.polyline,
         raw=excluded.raw, updated_at=excluded.updated_at`,
    )
    .bind(
      row.id, row.name, row.sport_type, row.start_date, row.local_date,
      row.elapsed_time, row.moving_time, row.distance, row.total_elevation_gain,
      row.average_speed, row.average_heartrate, row.suffer_score, row.polyline,
      row.raw, row.updated_at,
    )
    .run();
}

export async function deleteActivity(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM activities WHERE id = ?1").bind(id).run();
}

export async function getActivity(db: D1Database, id: number): Promise<ActivityRow | null> {
  return await db
    .prepare(`SELECT ${COLUMNS} FROM activities WHERE id = ?1`)
    .bind(id)
    .first<ActivityRow>();
}

export async function listActivities(db: D1Database): Promise<ActivityRow[]> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM activities ORDER BY start_date DESC`)
    .all<ActivityRow>();
  return results;
}
```

`worker/db/athlete.ts`:

```ts
import type { AthleteRecord } from "#shared/types";

interface AthleteDbRow {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  connected: number;
}

export async function getAthlete(db: D1Database): Promise<AthleteRecord | null> {
  const r = await db
    .prepare("SELECT id, access_token, refresh_token, expires_at, connected FROM athlete LIMIT 1")
    .first<AthleteDbRow>();
  return r ? { ...r, connected: r.connected === 1 } : null;
}

export async function saveAthlete(db: D1Database, rec: AthleteRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO athlete (id, access_token, refresh_token, expires_at, connected)
       VALUES (?1,?2,?3,?4,?5)
       ON CONFLICT(id) DO UPDATE SET
         access_token=excluded.access_token, refresh_token=excluded.refresh_token,
         expires_at=excluded.expires_at, connected=excluded.connected`,
    )
    .bind(rec.id, rec.access_token, rec.refresh_token, rec.expires_at, rec.connected ? 1 : 0)
    .run();
}

export async function setConnected(db: D1Database, id: number, connected: boolean): Promise<void> {
  await db
    .prepare("UPDATE athlete SET connected = ?2 WHERE id = ?1")
    .bind(id, connected ? 1 : 0)
    .run();
}
```

`worker/db/sync.ts`:

```ts
import type { BackfillState } from "#shared/types";

const DEFAULT: BackfillState = { page: 1, complete: false, last_error: null };

export async function getBackfillState(db: D1Database): Promise<BackfillState> {
  const r = await db
    .prepare("SELECT value FROM sync_state WHERE key = 'backfill'")
    .first<{ value: string }>();
  if (!r) return { ...DEFAULT };
  return { ...DEFAULT, ...(JSON.parse(r.value) as Partial<BackfillState>) };
}

export async function setBackfillState(db: D1Database, s: BackfillState): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_state (key, value) VALUES ('backfill', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .bind(JSON.stringify(s))
    .run();
}
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `pnpm exec vitest run worker/db`
Expected: PASS, 10 tests.

- [ ] **Step 8: Apply the migration locally**

```bash
pnpm db:migrate:local
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add D1 schema and the typed data layer"
```

---

### Task 3: Signed session cookie

**Files:**
- Create: `worker/session.ts`
- Test: `worker/session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `signSession(athleteId: number, secret: string): Promise<string>`
  - `verifySession(value: string | undefined, secret: string): Promise<number | null>`
  - `SESSION_COOKIE: string` (the cookie name, `"sd_session"`)

- [ ] **Step 1: Write the failing test**

`worker/session.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "test-secret-value";

describe("session", () => {
  it("round-trips an athlete id", async () => {
    const token = await signSession(42, SECRET);
    expect(await verifySession(token, SECRET)).toBe(42);
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(42, SECRET);
    const sig = token.split(".")[1] ?? "";
    expect(await verifySession(`99.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a signature made with a different secret", async () => {
    const token = await signSession(42, SECRET);
    expect(await verifySession(token, "other-secret")).toBeNull();
  });

  it("rejects undefined and malformed values", async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession("nonsense", SECRET)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run worker/session.test.ts`
Expected: FAIL — module `./session` not found.

- [ ] **Step 3: Write the implementation**

`worker/session.ts`:

```ts
export const SESSION_COOKIE = "sd_session";

async function key(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSession(athleteId: number, secret: string): Promise<string> {
  const payload = String(athleteId);
  const sig = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

export async function verifySession(
  value: string | undefined,
  secret: string,
): Promise<number | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const hex = value.slice(dot + 1);
  if (!/^[0-9]+$/.test(payload) || !/^[0-9a-f]+$/.test(hex) || hex.length % 2 !== 0) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);

  const ok = await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    bytes,
    new TextEncoder().encode(payload),
  );
  return ok ? Number(payload) : null;
}
```

`crypto.subtle.verify` is constant-time, which is why verification does not compare hex strings directly.

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm exec vitest run worker/session.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add signed session cookie"
```

---

### Task 4: Strava client — token refresh, rate limits, row mapping

**Files:**
- Create: `worker/strava/types.ts`, `worker/strava/client.ts`, `worker/strava/map.ts`
- Test: `worker/strava/client.test.ts`, `worker/strava/map.test.ts`

**Interfaces:**
- Consumes: `AthleteRecord`, `ActivityRow` (Task 2); `saveAthlete`, `setConnected` (Task 2); `Env` (Task 1).
- Produces:
  - `StravaActivity` (raw API shape)
  - `RateLimit { shortUsage, shortLimit, dailyUsage, dailyLimit }`
  - `parseRateLimit(headers: Headers): RateLimit | null`
  - `isNearLimit(r: RateLimit | null): boolean`
  - `class RateLimitError extends Error`
  - `class TokenRefreshError extends Error`
  - `class StravaClient` with `static async create(env: Env): Promise<StravaClient | null>`, `getActivity(id: number): Promise<StravaActivity>`, `listActivities(page: number, perPage: number): Promise<StravaActivity[]>`, `readonly athleteId: number`, `lastRateLimit: RateLimit | null`
  - `toRow(a: StravaActivity): ActivityRow`

- [ ] **Step 1: Write `worker/strava/types.ts`**

```ts
export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain?: number | null;
  average_speed?: number | null;
  average_heartrate?: number | null;
  suffer_score?: number | null;
  map?: { summary_polyline?: string | null } | null;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}
```

- [ ] **Step 2: Write the failing mapping test**

`worker/strava/map.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { toRow } from "./map";
import type { StravaActivity } from "./types";

const activity: StravaActivity = {
  id: 1360128428,
  name: "Evening Run",
  sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z",
  start_date_local: "2026-09-05T18:41:00Z",
  elapsed_time: 2052,
  moving_time: 2052,
  distance: 6420.5,
  total_elevation_gain: 48,
  average_speed: 3.13,
  average_heartrate: 152,
  suffer_score: 40,
  map: { summary_polyline: "abc123" },
};

describe("toRow", () => {
  it("takes local_date from start_date_local, not start_date", () => {
    // 16:41Z is the 5th in UTC and the 5th locally here, but the rule must
    // read the local field — an evening run in UTC+13 would differ.
    expect(toRow(activity).local_date).toBe("2026-09-05");
    expect(toRow({ ...activity, start_date_local: "2026-09-06T01:10:00Z" }).local_date)
      .toBe("2026-09-06");
  });

  it("flattens the summary polyline", () => {
    expect(toRow(activity).polyline).toBe("abc123");
    expect(toRow({ ...activity, map: null }).polyline).toBeNull();
    expect(toRow({ ...activity, map: {} }).polyline).toBeNull();
  });

  it("normalises absent optional numbers to null", () => {
    const r = toRow({ ...activity, average_heartrate: undefined, suffer_score: undefined });
    expect(r.average_heartrate).toBeNull();
    expect(r.suffer_score).toBeNull();
  });

  it("keeps the full payload in raw", () => {
    expect(JSON.parse(toRow(activity).raw).id).toBe(1360128428);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run worker/strava/map.test.ts`
Expected: FAIL — module `./map` not found.

- [ ] **Step 4: Write `worker/strava/map.ts`**

```ts
import type { ActivityRow } from "#shared/types";
import type { StravaActivity } from "./types";

export function toRow(a: StravaActivity): ActivityRow {
  return {
    id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    start_date: a.start_date,
    local_date: a.start_date_local.slice(0, 10),
    elapsed_time: a.elapsed_time,
    moving_time: a.moving_time,
    distance: a.distance,
    total_elevation_gain: a.total_elevation_gain ?? null,
    average_speed: a.average_speed ?? null,
    average_heartrate: a.average_heartrate ?? null,
    suffer_score: a.suffer_score ?? null,
    polyline: a.map?.summary_polyline ?? null,
    raw: JSON.stringify(a),
    updated_at: Math.floor(Date.now() / 1000),
  };
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm exec vitest run worker/strava/map.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Write the failing client test**

`worker/strava/client.test.ts`:

```ts
import { env, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import { StravaClient, parseRateLimit, isNearLimit, RateLimitError } from "./client";
import { saveAthlete, getAthlete } from "../db/athlete";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

const NOW = () => Math.floor(Date.now() / 1000);

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM athlete").run();
});

describe("parseRateLimit", () => {
  it("parses the paired usage and limit headers", () => {
    const h = new Headers({
      "X-RateLimit-Limit": "600,30000",
      "X-RateLimit-Usage": "300,15000",
    });
    expect(parseRateLimit(h)).toEqual({
      shortUsage: 300, shortLimit: 600, dailyUsage: 15000, dailyLimit: 30000,
    });
  });

  it("returns null when the headers are absent", () => {
    expect(parseRateLimit(new Headers())).toBeNull();
  });

  it("flags nearness at 90% of either window", () => {
    expect(isNearLimit({ shortUsage: 540, shortLimit: 600, dailyUsage: 1, dailyLimit: 30000 })).toBe(true);
    expect(isNearLimit({ shortUsage: 1, shortLimit: 600, dailyUsage: 27000, dailyLimit: 30000 })).toBe(true);
    expect(isNearLimit({ shortUsage: 1, shortLimit: 600, dailyUsage: 1, dailyLimit: 30000 })).toBe(false);
    expect(isNearLimit(null)).toBe(false);
  });
});

describe("StravaClient", () => {
  it("returns null when no athlete has connected", async () => {
    expect(await StravaClient.create(env)).toBeNull();
  });

  it("uses the stored token when it is still valid", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r", expires_at: NOW() + 3600, connected: true,
    });
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/activities/7", method: "GET" })
      .reply(200, { id: 7, name: "Run" });

    const client = await StravaClient.create(env);
    expect((await client!.getActivity(7)).id).toBe(7);
  });

  it("refreshes an expired token and persists the new pair", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "stale", refresh_token: "r0", expires_at: NOW() - 10, connected: true,
    });
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(200, { access_token: "fresh", refresh_token: "r1", expires_at: NOW() + 3600 });
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/activities/7", method: "GET" })
      .reply(200, { id: 7, name: "Run" });

    const client = await StravaClient.create(env);
    await client!.getActivity(7);

    const a = await getAthlete(env.DB);
    expect(a?.access_token).toBe("fresh");
    expect(a?.refresh_token).toBe("r1");
  });

  it("marks the athlete disconnected when the refresh token is rejected", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "stale", refresh_token: "bad", expires_at: NOW() - 10, connected: true,
    });
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(400, { message: "Bad Request" });

    await expect(StravaClient.create(env)).rejects.toThrow();
    expect((await getAthlete(env.DB))?.connected).toBe(false);
  });

  it("throws RateLimitError on a 429", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r", expires_at: NOW() + 3600, connected: true,
    });
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/activities/7", method: "GET" })
      .reply(429, {});

    const client = await StravaClient.create(env);
    await expect(client!.getActivity(7)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("records the rate limit from the last response", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r", expires_at: NOW() + 3600, connected: true,
    });
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/athlete/activities?page=1&per_page=200", method: "GET" })
      .reply(200, [{ id: 1 }], {
        headers: { "X-RateLimit-Limit": "600,30000", "X-RateLimit-Usage": "10,20" },
      });

    const client = await StravaClient.create(env);
    await client!.listActivities(1, 200);
    expect(client!.lastRateLimit?.shortUsage).toBe(10);
  });
});
```

- [ ] **Step 7: Run it to verify it fails**

Run: `pnpm exec vitest run worker/strava/client.test.ts`
Expected: FAIL — module `./client` not found.

- [ ] **Step 8: Write `worker/strava/client.ts`**

```ts
import type { Env } from "../env";
import type { AthleteRecord } from "#shared/types";
import { getAthlete, saveAthlete, setConnected } from "../db/athlete";
import type { StravaActivity, StravaTokenResponse } from "./types";

const BASE = "https://www.strava.com";

export interface RateLimit {
  shortUsage: number;
  shortLimit: number;
  dailyUsage: number;
  dailyLimit: number;
}

export class RateLimitError extends Error {
  constructor() {
    super("Strava rate limit reached");
    this.name = "RateLimitError";
  }
}

export class TokenRefreshError extends Error {
  constructor(status: number) {
    super(`Strava refused the refresh token (HTTP ${status})`);
    this.name = "TokenRefreshError";
  }
}

export function parseRateLimit(headers: Headers): RateLimit | null {
  const limit = headers.get("X-RateLimit-Limit");
  const usage = headers.get("X-RateLimit-Usage");
  if (!limit || !usage) return null;
  const l = limit.split(",").map(Number);
  const u = usage.split(",").map(Number);
  const [shortLimit, dailyLimit] = [l[0], l[1]];
  const [shortUsage, dailyUsage] = [u[0], u[1]];
  if (
    shortLimit === undefined || dailyLimit === undefined ||
    shortUsage === undefined || dailyUsage === undefined
  ) return null;
  return { shortUsage, shortLimit, dailyUsage, dailyLimit };
}

export function isNearLimit(r: RateLimit | null): boolean {
  if (!r) return false;
  return r.shortUsage / r.shortLimit >= 0.9 || r.dailyUsage / r.dailyLimit >= 0.9;
}

export class StravaClient {
  lastRateLimit: RateLimit | null = null;

  private constructor(
    private readonly env: Env,
    private token: string,
    readonly athleteId: number,
  ) {}

  static async create(env: Env): Promise<StravaClient | null> {
    const athlete = await getAthlete(env.DB);
    if (!athlete) return null;

    const now = Math.floor(Date.now() / 1000);
    const token =
      athlete.expires_at > now + 60
        ? athlete.access_token
        : await StravaClient.refresh(env, athlete);

    return new StravaClient(env, token, athlete.id);
  }

  private static async refresh(env: Env, athlete: AthleteRecord): Promise<string> {
    const res = await fetch(`${BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: athlete.refresh_token,
      }),
    });

    if (!res.ok) {
      await setConnected(env.DB, athlete.id, false);
      throw new TokenRefreshError(res.status);
    }

    const t = (await res.json()) as StravaTokenResponse;
    await saveAthlete(env.DB, {
      id: athlete.id,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: t.expires_at,
      connected: true,
    });
    return t.access_token;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    this.lastRateLimit = parseRateLimit(res.headers);
    if (res.status === 429) throw new RateLimitError();
    if (!res.ok) throw new Error(`Strava GET ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async getActivity(id: number): Promise<StravaActivity> {
    return await this.get<StravaActivity>(`/api/v3/activities/${id}`);
  }

  async listActivities(page: number, perPage: number): Promise<StravaActivity[]> {
    return await this.get<StravaActivity[]>(
      `/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
    );
  }
}
```

- [ ] **Step 9: Run it to verify it passes**

Run: `pnpm exec vitest run worker/strava`
Expected: PASS, 13 tests.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add Strava client with token refresh and rate-limit awareness"
```

---

### Task 5: OAuth routes and the athlete gate

**Files:**
- Create: `worker/strava/oauth.ts`, `worker/routes/auth.ts`
- Modify: `worker/index.ts`
- Test: `worker/routes/auth.test.ts`

**Interfaces:**
- Consumes: `Env`, `signSession`, `SESSION_COOKIE`, `saveAthlete`, `getAthlete`, `StravaTokenResponse`.
- Produces:
  - `buildAuthorizeUrl(env: Env): string`
  - `exchangeCode(env: Env, code: string): Promise<StravaTokenResponse>`
  - `athleteAllowed(env: Env, id: number): Promise<boolean>`
  - A Hono sub-app default-exported from `worker/routes/auth.ts`, mounted at `/auth`.

- [ ] **Step 1: Write the failing test**

`worker/routes/auth.test.ts`:

```ts
import { env, fetchMock, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import { getAthlete } from "../db/athlete";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());
beforeEach(async () => {
  await env.DB.prepare("DELETE FROM athlete").run();
});

const tokenReply = (athleteId: number) => ({
  access_token: "a",
  refresh_token: "r",
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  athlete: { id: athleteId },
});

describe("/auth", () => {
  it("redirects to Strava with the read-all scope", async () => {
    const res = await SELF.fetch("http://example.com/auth/login", { redirect: "manual" });
    expect(res.status).toBe(302);
    const loc = res.headers.get("location") ?? "";
    expect(loc).toContain("https://www.strava.com/oauth/authorize");
    expect(loc).toContain("scope=activity%3Aread_all");
  });

  it("stores the athlete and sets a session cookie on callback", async () => {
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(200, tokenReply(42));

    const res = await SELF.fetch("http://example.com/auth/callback?code=xyz", {
      redirect: "manual",
    });

    expect(res.status).toBe(302);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("sd_session=");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
    expect((await getAthlete(env.DB))?.id).toBe(42);
  });

  it("refuses a second athlete once one has claimed the instance", async () => {
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(200, tokenReply(42));
    await SELF.fetch("http://example.com/auth/callback?code=xyz", { redirect: "manual" });

    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/oauth/token", method: "POST" })
      .reply(200, tokenReply(99));
    const res = await SELF.fetch("http://example.com/auth/callback?code=abc", {
      redirect: "manual",
    });

    expect(res.status).toBe(403);
    expect((await getAthlete(env.DB))?.id).toBe(42);
  });

  it("rejects a callback with no code", async () => {
    const res = await SELF.fetch("http://example.com/auth/callback");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run worker/routes/auth.test.ts`
Expected: FAIL — 404 on `/auth/login`.

- [ ] **Step 3: Write `worker/strava/oauth.ts`**

```ts
import type { Env } from "../env";
import { getAthlete } from "../db/athlete";
import type { StravaTokenResponse } from "./types";

const BASE = "https://www.strava.com";

export function buildAuthorizeUrl(env: Env): string {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/auth/callback`,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
  });
  return `${BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(env: Env, code: string): Promise<StravaTokenResponse> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`Strava code exchange failed: ${res.status}`);
  return (await res.json()) as StravaTokenResponse;
}

/**
 * The single-athlete gate. An explicit ALLOWED_ATHLETE_ID always wins.
 * Otherwise the first athlete to connect claims the instance, and anyone
 * who follows is refused.
 */
export async function athleteAllowed(env: Env, id: number): Promise<boolean> {
  if (env.ALLOWED_ATHLETE_ID) return String(id) === env.ALLOWED_ATHLETE_ID;
  const existing = await getAthlete(env.DB);
  return existing === null || existing.id === id;
}
```

- [ ] **Step 4: Write `worker/routes/auth.ts`**

```ts
import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";
import { buildAuthorizeUrl, exchangeCode, athleteAllowed } from "../strava/oauth";
import { saveAthlete } from "../db/athlete";
import { signSession, SESSION_COOKIE } from "../session";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/login", (c) => c.redirect(buildAuthorizeUrl(c.env), 302));

auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "missing code" }, 400);

  const token = await exchangeCode(c.env, code);
  const athleteId = token.athlete?.id;
  if (!athleteId) return c.json({ error: "no athlete in token response" }, 400);

  if (!(await athleteAllowed(c.env, athleteId))) {
    return c.json({ error: "this instance belongs to another athlete" }, 403);
  }

  await saveAthlete(c.env.DB, {
    id: athleteId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: token.expires_at,
    connected: true,
  });

  setCookie(c, SESSION_COOKIE, await signSession(athleteId, c.env.SESSION_SECRET), {
    httpOnly: true,
    secure: c.env.APP_URL.startsWith("https"),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return c.redirect("/", 302);
});

auth.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

export default auth;
```

Backfill is enqueued here in Task 6; leave the callback as written for now.

- [ ] **Step 5: Mount it in `worker/index.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "./env";
import auth from "./routes/auth";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/auth", auth);

export default app;
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm exec vitest run worker/routes/auth.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Strava OAuth with the single-athlete gate"
```

---

### Task 6: Resumable backfill

**Files:**
- Create: `worker/sync/backfill.ts`
- Modify: `worker/routes/auth.ts` (enqueue after connect)
- Test: `worker/sync/backfill.test.ts`

**Interfaces:**
- Consumes: `StravaClient`, `RateLimitError`, `isNearLimit`, `toRow`, `upsertActivity`, `getBackfillState`, `setBackfillState`, `Env`.
- Produces: `runBackfill(env: Env, client: StravaClient): Promise<BackfillState>` and `PER_PAGE = 200`.

- [ ] **Step 1: Write the failing test**

`worker/sync/backfill.test.ts`:

```ts
import { env, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import { runBackfill } from "./backfill";
import { StravaClient } from "../strava/client";
import { saveAthlete } from "../db/athlete";
import { getBackfillState, setBackfillState } from "../db/sync";
import { listActivities } from "../db/activities";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

const act = (id: number) => ({
  id, name: `Run ${id}`, sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z", start_date_local: "2026-09-05T18:41:00Z",
  elapsed_time: 100, moving_time: 100, distance: 1000,
});

const page = (n: number) => ({ path: `/api/v3/athlete/activities?page=${n}&per_page=200`, method: "GET" });

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  await saveAthlete(env.DB, {
    id: 42, access_token: "good", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
  });
});

describe("runBackfill", () => {
  it("pages until a short page and marks itself complete", async () => {
    fetchMock.get("https://www.strava.com").intercept(page(1)).reply(200, [act(1), act(2)]);
    fetchMock.get("https://www.strava.com").intercept(page(2)).reply(200, []);

    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);

    expect(state.complete).toBe(true);
    expect(await listActivities(env.DB)).toHaveLength(2);
  });

  it("stops on a 429 and saves the page to resume from", async () => {
    fetchMock.get("https://www.strava.com").intercept(page(1)).reply(200, [act(1)]);
    fetchMock.get("https://www.strava.com").intercept(page(2)).reply(429, {});

    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);

    expect(state.complete).toBe(false);
    expect(state.page).toBe(2);
    expect(state.last_error).toContain("rate limit");
    expect(await listActivities(env.DB)).toHaveLength(1);
  });

  it("resumes from the saved page rather than restarting", async () => {
    await setBackfillState(env.DB, { page: 3, complete: false, last_error: null });
    fetchMock.get("https://www.strava.com").intercept(page(3)).reply(200, [act(9)]);
    fetchMock.get("https://www.strava.com").intercept(page(4)).reply(200, []);

    const client = await StravaClient.create(env);
    await runBackfill(env, client!);

    expect((await listActivities(env.DB)).map((a) => a.id)).toEqual([9]);
  });

  it("does nothing once complete", async () => {
    await setBackfillState(env.DB, { page: 7, complete: true, last_error: null });
    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);
    expect(state.complete).toBe(true);
    // No interceptors registered — assertNoPendingInterceptors would fail on a call.
  });

  it("stops early when the rate limit is nearly exhausted", async () => {
    fetchMock
      .get("https://www.strava.com")
      .intercept(page(1))
      .reply(200, [act(1)], {
        headers: { "X-RateLimit-Limit": "600,30000", "X-RateLimit-Usage": "595,100" },
      });

    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);

    expect(state.complete).toBe(false);
    expect(state.page).toBe(2);
    expect(await listActivities(env.DB)).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run worker/sync/backfill.test.ts`
Expected: FAIL — module `./backfill` not found.

- [ ] **Step 3: Write `worker/sync/backfill.ts`**

```ts
import type { Env } from "../env";
import type { BackfillState } from "#shared/types";
import { StravaClient, RateLimitError, isNearLimit } from "../strava/client";
import { toRow } from "../strava/map";
import { upsertActivity } from "../db/activities";
import { getBackfillState, setBackfillState } from "../db/sync";

export const PER_PAGE = 200;

/**
 * Imports history newest-first, saving the resume point after every page.
 * Returns rather than retries when Strava pushes back: the scheduled handler
 * picks the run up again later.
 */
export async function runBackfill(env: Env, client: StravaClient): Promise<BackfillState> {
  const state = await getBackfillState(env.DB);
  if (state.complete) return state;

  let page = state.page;

  for (;;) {
    let batch;
    try {
      batch = await client.listActivities(page, PER_PAGE);
    } catch (err) {
      const next: BackfillState = {
        page,
        complete: false,
        last_error: err instanceof RateLimitError ? "rate limit reached" : String(err),
      };
      await setBackfillState(env.DB, next);
      return next;
    }

    for (const a of batch) {
      await upsertActivity(env.DB, toRow(a));
    }

    if (batch.length < PER_PAGE) {
      const done: BackfillState = { page, complete: true, last_error: null };
      await setBackfillState(env.DB, done);
      return done;
    }

    page += 1;

    if (isNearLimit(client.lastRateLimit)) {
      const paused: BackfillState = {
        page,
        complete: false,
        last_error: "paused near rate limit",
      };
      await setBackfillState(env.DB, paused);
      return paused;
    }

    await setBackfillState(env.DB, { page, complete: false, last_error: null });
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run worker/sync/backfill.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Enqueue backfill after connect**

In `worker/routes/auth.ts`, add the imports:

```ts
import { StravaClient } from "../strava/client";
import { runBackfill } from "../sync/backfill";
```

and insert this immediately before the `return c.redirect("/", 302);` in the callback handler:

```ts
  c.executionCtx.waitUntil(
    (async () => {
      const client = await StravaClient.create(c.env);
      if (client) await runBackfill(c.env, client);
    })().catch((err) => console.error("backfill failed", err)),
  );
```

- [ ] **Step 6: Run the whole suite**

Run: `pnpm test`
Expected: PASS, all tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add resumable Strava backfill"
```

---

### Task 7: The Durable Object live room

**Files:**
- Create: `worker/live/room.ts`
- Modify: `shared/types.ts` (add `LiveMessage`), `worker/index.ts` (export the class)
- Test: `worker/live/room.test.ts`

**Interfaces:**
- Consumes: `Env`.
- Produces:
  - `LiveMessage = { type: "activity.upsert"; activity: ActivityRow } | { type: "activity.delete"; id: number }`
  - `class LiveRoom extends DurableObject` — `fetch` handles `GET /connect` (upgrade) and `POST /broadcast`
  - `broadcast(env: Env, msg: LiveMessage): Promise<void>`

- [ ] **Step 1: Add `LiveMessage` to `shared/types.ts`**

```ts
export type LiveMessage =
  | { type: "activity.upsert"; activity: ActivityRow }
  | { type: "activity.delete"; id: number };
```

- [ ] **Step 2: Write the failing test**

`worker/live/room.test.ts`:

```ts
import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { LiveMessage } from "#shared/types";

function connect(name = "live"): Promise<WebSocket> {
  const stub = env.LIVE.getByName(name);
  return stub
    .fetch("http://do/connect", { headers: { Upgrade: "websocket" } })
    .then((res) => {
      const ws = res.webSocket;
      if (!ws) throw new Error("no websocket on the response");
      ws.accept();
      return ws;
    });
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.addEventListener("message", (e) => resolve(String(e.data)), { once: true });
  });
}

const msg: LiveMessage = { type: "activity.delete", id: 7 };

describe("LiveRoom", () => {
  it("refuses a non-upgrade request to /connect", async () => {
    const stub = env.LIVE.getByName("t-refuse");
    const res = await stub.fetch("http://do/connect");
    expect(res.status).toBe(426);
  });

  it("delivers a broadcast to a connected socket", async () => {
    const stub = env.LIVE.getByName("t-one");
    const ws = await (async () => {
      const res = await stub.fetch("http://do/connect", { headers: { Upgrade: "websocket" } });
      const s = res.webSocket!;
      s.accept();
      return s;
    })();

    const received = nextMessage(ws);
    await stub.fetch("http://do/broadcast", { method: "POST", body: JSON.stringify(msg) });

    expect(JSON.parse(await received)).toEqual(msg);
  });

  it("delivers to every connected socket", async () => {
    const stub = env.LIVE.getByName("t-many");
    const open = async () => {
      const res = await stub.fetch("http://do/connect", { headers: { Upgrade: "websocket" } });
      const s = res.webSocket!;
      s.accept();
      return s;
    };
    const a = await open();
    const b = await open();

    const both = Promise.all([nextMessage(a), nextMessage(b)]);
    await stub.fetch("http://do/broadcast", { method: "POST", body: JSON.stringify(msg) });

    const [ra, rb] = await both;
    expect(JSON.parse(ra)).toEqual(msg);
    expect(JSON.parse(rb)).toEqual(msg);
  });

  it("reports how many sockets a broadcast reached", async () => {
    const stub = env.LIVE.getByName("t-count");
    const res = await stub.fetch("http://do/broadcast", {
      method: "POST",
      body: JSON.stringify(msg),
    });
    expect(await res.json()).toEqual({ delivered: 0 });
  });

  it("404s an unknown path", async () => {
    const stub = env.LIVE.getByName("t-404");
    expect((await stub.fetch("http://do/nope")).status).toBe(404);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run worker/live/room.test.ts`
Expected: FAIL — `LiveRoom` is not exported from the Worker entrypoint.

- [ ] **Step 4: Write `worker/live/room.ts`**

```ts
import { DurableObject } from "cloudflare:workers";
import type { Env } from "../env";
import type { LiveMessage } from "#shared/types";

export class LiveRoom extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // Heartbeats are answered by the runtime without waking this object,
    // so an idle connection costs no duration billing.
    this.ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping", "pong"));
  }

  override async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/connect") {
      if (request.headers.get("Upgrade") !== "websocket") {
        return new Response("Expected WebSocket", { status: 426 });
      }
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      // acceptWebSocket, not server.accept() — this is what makes the socket
      // hibernatable, letting the object be evicted while it stays open.
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    if (url.pathname === "/broadcast" && request.method === "POST") {
      const body = await request.text();
      let delivered = 0;
      for (const ws of this.ctx.getWebSockets()) {
        try {
          ws.send(body);
          delivered += 1;
        } catch {
          // A socket that died between enumeration and send is not an error;
          // the client refetches on reconnect.
        }
      }
      return Response.json({ delivered });
    }

    return new Response("Not found", { status: 404 });
  }

  override async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    ws.close(code, reason);
  }
}

export async function broadcast(env: Env, msg: LiveMessage): Promise<void> {
  const stub = env.LIVE.getByName("live");
  await stub.fetch("http://do/broadcast", { method: "POST", body: JSON.stringify(msg) });
}
```

- [ ] **Step 5: Export the class from `worker/index.ts`**

Add to `worker/index.ts`:

```ts
export { LiveRoom } from "./live/room";
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm exec vitest run worker/live/room.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the Durable Object live room with hibernation"
```

---

### Task 8: Webhook — validation, two-second ack, and ingest

**Files:**
- Create: `worker/sync/ingest.ts`, `worker/routes/webhook.ts`
- Modify: `worker/index.ts`
- Test: `worker/sync/ingest.test.ts`, `worker/routes/webhook.test.ts`

**Interfaces:**
- Consumes: `StravaClient`, `toRow`, `upsertActivity`, `deleteActivity`, `broadcast`, `Env`.
- Produces:
  - `StravaWebhookEvent { object_type, object_id, aspect_type, owner_id, subscription_id, event_time, updates }`
  - `handleEvent(env: Env, event: StravaWebhookEvent): Promise<void>`
  - A Hono sub-app default-exported from `worker/routes/webhook.ts`, mounted at `/webhook`.

- [ ] **Step 1: Write the failing ingest test**

`worker/sync/ingest.test.ts`:

```ts
import { env, fetchMock } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import { handleEvent } from "./ingest";
import { saveAthlete } from "../db/athlete";
import { upsertActivity, getActivity } from "../db/activities";
import type { StravaWebhookEvent } from "./ingest";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

const event = (over: Partial<StravaWebhookEvent> = {}): StravaWebhookEvent => ({
  object_type: "activity",
  object_id: 7,
  aspect_type: "create",
  owner_id: 42,
  subscription_id: 1,
  event_time: 1,
  updates: {},
  ...over,
});

const activity = {
  id: 7, name: "Evening Run", sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z", start_date_local: "2026-09-05T18:41:00Z",
  elapsed_time: 100, moving_time: 100, distance: 1000,
};

const row = {
  id: 7, name: "Old", sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z", local_date: "2026-09-05",
  elapsed_time: 100, moving_time: 100, distance: 1000,
  total_elevation_gain: null, average_speed: null, average_heartrate: null,
  suffer_score: null, polyline: null, raw: "{}", updated_at: 1,
};

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
  ]);
  await saveAthlete(env.DB, {
    id: 42, access_token: "good", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
  });
});

describe("handleEvent", () => {
  it("fetches and upserts on create", async () => {
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/activities/7", method: "GET" })
      .reply(200, activity);

    await handleEvent(env, event());
    expect((await getActivity(env.DB, 7))?.name).toBe("Evening Run");
  });

  it("refetches on update, overwriting the stored row", async () => {
    await upsertActivity(env.DB, row);
    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/activities/7", method: "GET" })
      .reply(200, { ...activity, name: "Renamed" });

    await handleEvent(env, event({ aspect_type: "update" }));
    expect((await getActivity(env.DB, 7))?.name).toBe("Renamed");
  });

  it("deletes without fetching", async () => {
    await upsertActivity(env.DB, row);
    await handleEvent(env, event({ aspect_type: "delete" }));
    expect(await getActivity(env.DB, 7)).toBeNull();
  });

  it("ignores an event owned by another athlete", async () => {
    await handleEvent(env, event({ owner_id: 999 }));
    expect(await getActivity(env.DB, 7)).toBeNull();
  });

  it("ignores athlete-scoped events", async () => {
    await handleEvent(env, event({ object_type: "athlete" }));
    expect(await getActivity(env.DB, 7)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run worker/sync/ingest.test.ts`
Expected: FAIL — module `./ingest` not found.

- [ ] **Step 3: Write `worker/sync/ingest.ts`**

```ts
import type { Env } from "../env";
import { StravaClient } from "../strava/client";
import { toRow } from "../strava/map";
import { upsertActivity, deleteActivity } from "../db/activities";
import { getAthlete } from "../db/athlete";
import { broadcast } from "../live/room";

export interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates: Record<string, string>;
}

/**
 * One event, one row change. Runs inside ctx.waitUntil() — the webhook has
 * already answered 200 by the time this executes, so a throw here loses the
 * event and nothing more. The client's refetch-on-visibility closes the gap.
 */
export async function handleEvent(env: Env, event: StravaWebhookEvent): Promise<void> {
  if (event.object_type !== "activity") return;

  const athlete = await getAthlete(env.DB);
  if (!athlete || athlete.id !== event.owner_id) return;

  if (event.aspect_type === "delete") {
    await deleteActivity(env.DB, event.object_id);
    await broadcast(env, { type: "activity.delete", id: event.object_id });
    return;
  }

  const client = await StravaClient.create(env);
  if (!client) return;

  const row = toRow(await client.getActivity(event.object_id));
  await upsertActivity(env.DB, row);
  await broadcast(env, { type: "activity.upsert", activity: row });
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run worker/sync/ingest.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Write the failing webhook route test**

`worker/routes/webhook.test.ts`:

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("GET /webhook (subscription validation)", () => {
  it("echoes hub.challenge as JSON when the verify token matches", async () => {
    const q = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": env.STRAVA_VERIFY_TOKEN,
      "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3",
    });
    const res = await SELF.fetch(`http://example.com/webhook?${q}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({
      "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3",
    });
  });

  it("refuses a wrong verify token", async () => {
    const q = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "abc",
    });
    expect((await SELF.fetch(`http://example.com/webhook?${q}`)).status).toBe(403);
  });
});

describe("POST /webhook", () => {
  it("acknowledges immediately with 200", async () => {
    const res = await SELF.fetch("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object_type: "activity", object_id: 1, aspect_type: "create",
        owner_id: 42, subscription_id: 1, event_time: 1, updates: {},
      }),
    });
    expect(res.status).toBe(200);
  });

  it("still returns 200 on a malformed body", async () => {
    const res = await SELF.fetch("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(200);
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `pnpm exec vitest run worker/routes/webhook.test.ts`
Expected: FAIL — 404 on `/webhook`.

- [ ] **Step 7: Write `worker/routes/webhook.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "../env";
import { handleEvent, type StravaWebhookEvent } from "../sync/ingest";

const webhook = new Hono<{ Bindings: Env }>();

/**
 * Subscription validation. Strava requires a 200 within two seconds carrying
 * the challenge echoed as JSON — a slow or malformed reply here is the most
 * common reason subscription creation fails.
 */
webhook.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode !== "subscribe" || token !== c.env.STRAVA_VERIFY_TOKEN || !challenge) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json({ "hub.challenge": challenge });
});

/**
 * Event receipt. Acknowledge first, work second: the two-second deadline is
 * far shorter than a Strava fetch plus a D1 write.
 */
webhook.post("/", async (c) => {
  let event: StravaWebhookEvent | null = null;
  try {
    event = (await c.req.json()) as StravaWebhookEvent;
  } catch {
    // A body we cannot parse is still acknowledged; retrying it would not help.
    return c.json({ ok: true });
  }

  const e = event;
  c.executionCtx.waitUntil(
    handleEvent(c.env, e).catch((err) => console.error("ingest failed", err)),
  );

  return c.json({ ok: true });
});

export default webhook;
```

- [ ] **Step 8: Mount it in `worker/index.ts`**

```ts
import webhook from "./routes/webhook";
// ...
app.route("/webhook", webhook);
```

- [ ] **Step 9: Run it to verify it passes**

Run: `pnpm exec vitest run worker/routes/webhook.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add the Strava webhook with ack-then-ingest"
```

---

### Task 9: Session-guarded API and the `/live` upgrade

**Files:**
- Create: `worker/routes/api.ts`, `worker/middleware/require-session.ts`
- Modify: `worker/index.ts`
- Test: `worker/routes/api.test.ts`

**Interfaces:**
- Consumes: `verifySession`, `SESSION_COOKIE`, `getAthlete`, `listActivities`, `getActivity`, `getBackfillState`, `Env`.
- Produces:
  - `requireSession` — Hono middleware setting `athleteId` on the context
  - `ActivitySummary` — `ActivityRow` without `raw` and `polyline`
  - A Hono sub-app default-exported from `worker/routes/api.ts`, mounted at `/api`

- [ ] **Step 1: Add `ActivitySummary` to `shared/types.ts`**

```ts
export type ActivitySummary = Omit<ActivityRow, "raw" | "polyline">;
```

- [ ] **Step 2: Write the failing test**

`worker/routes/api.test.ts`:

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { signSession } from "../session";
import { saveAthlete } from "../db/athlete";
import { upsertActivity } from "../db/activities";

const row = {
  id: 7, name: "Evening Run", sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z", local_date: "2026-09-05",
  elapsed_time: 100, moving_time: 100, distance: 1000,
  total_elevation_gain: null, average_speed: null, average_heartrate: null,
  suffer_score: null, polyline: "poly", raw: '{"id":7}', updated_at: 1,
};

async function cookie(): Promise<string> {
  return `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  await saveAthlete(env.DB, {
    id: 42, access_token: "a", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
  });
});

describe("/api guard", () => {
  it("401s without a session cookie", async () => {
    expect((await SELF.fetch("http://example.com/api/me")).status).toBe(401);
  });

  it("401s on a forged cookie", async () => {
    const res = await SELF.fetch("http://example.com/api/me", {
      headers: { Cookie: "sd_session=42.deadbeef" },
    });
    expect(res.status).toBe(401);
  });
});

describe("/api/me", () => {
  it("reports connection state and backfill progress", async () => {
    const res = await SELF.fetch("http://example.com/api/me", {
      headers: { Cookie: await cookie() },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      athleteId: 42,
      connected: true,
      backfill: { page: 1, complete: false, last_error: null },
    });
  });
});

describe("/api/activities", () => {
  it("omits raw and polyline from the list", async () => {
    await upsertActivity(env.DB, row);
    const res = await SELF.fetch("http://example.com/api/activities", {
      headers: { Cookie: await cookie() },
    });
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty("raw");
    expect(body[0]).not.toHaveProperty("polyline");
    expect(body[0]?.name).toBe("Evening Run");
  });

  it("returns one activity in full, including the polyline", async () => {
    await upsertActivity(env.DB, row);
    const res = await SELF.fetch("http://example.com/api/activities/7", {
      headers: { Cookie: await cookie() },
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.polyline).toBe("poly");
  });

  it("404s an unknown activity", async () => {
    const res = await SELF.fetch("http://example.com/api/activities/999", {
      headers: { Cookie: await cookie() },
    });
    expect(res.status).toBe(404);
  });
});

describe("/live", () => {
  it("401s without a session", async () => {
    const res = await SELF.fetch("http://example.com/live", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(401);
  });

  it("426s a non-upgrade request that carries a session", async () => {
    const res = await SELF.fetch("http://example.com/live", {
      headers: { Cookie: await cookie() },
    });
    expect(res.status).toBe(426);
  });

  it("upgrades with a valid session", async () => {
    const res = await SELF.fetch("http://example.com/live", {
      headers: { Cookie: await cookie(), Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm exec vitest run worker/routes/api.test.ts`
Expected: FAIL — 404 on `/api/me`.

- [ ] **Step 4: Write `worker/middleware/require-session.ts`**

```ts
import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../env";
import { verifySession, SESSION_COOKIE } from "../session";

export const requireSession = createMiddleware<{
  Bindings: Env;
  Variables: { athleteId: number };
}>(async (c, next) => {
  const athleteId = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET);
  if (athleteId === null) return c.json({ error: "unauthorized" }, 401);
  c.set("athleteId", athleteId);
  await next();
});
```

- [ ] **Step 5: Write `worker/routes/api.ts`**

```ts
import { Hono } from "hono";
import type { Env } from "../env";
import type { ActivitySummary } from "#shared/types";
import { requireSession } from "../middleware/require-session";
import { getAthlete } from "../db/athlete";
import { listActivities, getActivity } from "../db/activities";
import { getBackfillState } from "../db/sync";

const api = new Hono<{ Bindings: Env; Variables: { athleteId: number } }>();

api.use("*", requireSession);

api.get("/me", async (c) => {
  const athlete = await getAthlete(c.env.DB);
  return c.json({
    athleteId: c.get("athleteId"),
    connected: athlete?.connected ?? false,
    backfill: await getBackfillState(c.env.DB),
  });
});

api.get("/activities", async (c) => {
  const rows = await listActivities(c.env.DB);
  const summaries: ActivitySummary[] = rows.map(({ raw: _raw, polyline: _poly, ...rest }) => rest);
  return c.json(summaries);
});

api.get("/activities/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "bad id" }, 400);
  const row = await getActivity(c.env.DB, id);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

export default api;
```

- [ ] **Step 6: Add `/api` and `/live` to `worker/index.ts`**

```ts
import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "./env";
import auth from "./routes/auth";
import api from "./routes/api";
import webhook from "./routes/webhook";
import { verifySession, SESSION_COOKIE } from "./session";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/auth", auth);
app.route("/api", api);
app.route("/webhook", webhook);

app.get("/live", async (c) => {
  const athleteId = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET);
  if (athleteId === null) return c.json({ error: "unauthorized" }, 401);
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }
  const stub = c.env.LIVE.getByName("live");
  return await stub.fetch("http://do/connect", { headers: { Upgrade: "websocket" } });
});

export default app;
export { LiveRoom } from "./live/room";
```

`/api/health` is registered before `app.route("/api", api)` so it stays outside the session guard.

- [ ] **Step 7: Run it to verify it passes**

Run: `pnpm exec vitest run worker/routes/api.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add session-guarded API and the /live upgrade"
```

---

### Task 10: Webhook subscription management script

**Files:**
- Create: `scripts/webhook.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing from the Worker — this is a standalone Node script reading `.dev.vars`.
- Produces: `pnpm webhook create <url> | list | delete <id>`.

Strava allows exactly one active subscription per application, so `create` must be preceded by `list` and, if one exists, `delete`.

- [ ] **Step 1: Write `scripts/webhook.ts`**

```ts
/**
 * Manage the single Strava webhook subscription this application is allowed.
 *
 *   pnpm webhook list
 *   pnpm webhook create https://<public-host>/webhook
 *   pnpm webhook delete <id>
 *
 * Reads credentials from .dev.vars.
 */
import { readFileSync } from "node:fs";

const ENDPOINT = "https://www.strava.com/api/v3/push_subscriptions";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = loadEnv();
const clientId = env.STRAVA_CLIENT_ID;
const clientSecret = env.STRAVA_CLIENT_SECRET;
const verifyToken = env.STRAVA_VERIFY_TOKEN;

if (!clientId || !clientSecret || !verifyToken) {
  console.error("Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET or STRAVA_VERIFY_TOKEN in .dev.vars");
  process.exit(1);
}

const [command, arg] = process.argv.slice(2);

async function list(): Promise<void> {
  const q = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret! });
  const res = await fetch(`${ENDPOINT}?${q}`);
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}

async function create(callbackUrl: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    callback_url: callbackUrl,
    verify_token: verifyToken!,
  });
  const res = await fetch(ENDPOINT, { method: "POST", body });
  const text = await res.text();
  console.log(res.status, text);
  if (!res.ok) {
    console.error(
      "\nIf this says a subscription already exists, run `pnpm webhook list` then " +
        "`pnpm webhook delete <id>`.\nIf it says the callback failed validation, " +
        "check that GET /webhook answers within two seconds with the challenge as JSON.",
    );
  }
}

async function remove(id: string): Promise<void> {
  const q = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret! });
  const res = await fetch(`${ENDPOINT}/${id}?${q}`, { method: "DELETE" });
  console.log(res.status, await res.text());
}

switch (command) {
  case "list":
    await list();
    break;
  case "create":
    if (!arg) {
      console.error("usage: pnpm webhook create https://<host>/webhook");
      process.exit(1);
    }
    await create(arg);
    break;
  case "delete":
    if (!arg) {
      console.error("usage: pnpm webhook delete <id>");
      process.exit(1);
    }
    await remove(arg);
    break;
  default:
    console.error("usage: pnpm webhook <list|create <url>|delete <id>>");
    process.exit(1);
}
```

- [ ] **Step 2: Add the script to `package.json`**

```json
"webhook": "node --experimental-strip-types scripts/webhook.ts"
```

- [ ] **Step 3: Verify it runs and reports usage**

Run: `pnpm webhook`
Expected: prints the usage line and exits non-zero.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add Strava webhook subscription management script"
```

---

### Task 11: Scheduled backfill resume, and the pipeline end to end

**Files:**
- Modify: `worker/index.ts`
- Test: `worker/scheduled.test.ts`, `worker/pipeline.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: a `scheduled` handler on the default export; no new modules.

- [ ] **Step 1: Write the failing scheduled-handler test**

`worker/scheduled.test.ts`:

```ts
import { env, fetchMock, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import worker from "./index";
import { saveAthlete } from "./db/athlete";
import { setBackfillState, getBackfillState } from "./db/sync";
import { listActivities } from "./db/activities";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
});

const controller = { cron: "0 * * * *", scheduledTime: Date.now(), noRetry: () => {} };

describe("scheduled", () => {
  it("resumes an incomplete backfill", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
    });
    await setBackfillState(env.DB, { page: 2, complete: false, last_error: "rate limit reached" });

    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/athlete/activities?page=2&per_page=200", method: "GET" })
      .reply(200, [{
        id: 5, name: "Run", sport_type: "Run",
        start_date: "2026-09-05T16:41:00Z", start_date_local: "2026-09-05T18:41:00Z",
        elapsed_time: 1, moving_time: 1, distance: 1,
      }]);

    const ctx = createExecutionContext();
    await worker.scheduled!(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    expect((await getBackfillState(env.DB)).complete).toBe(true);
    expect(await listActivities(env.DB)).toHaveLength(1);
  });

  it("does nothing when no athlete has connected", async () => {
    const ctx = createExecutionContext();
    await worker.scheduled!(controller, env, ctx);
    await waitOnExecutionContext(ctx);
    // No interceptors registered; assertNoPendingInterceptors would fail on a call.
    expect(await listActivities(env.DB)).toHaveLength(0);
  });

  it("does nothing once the backfill is complete", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
    });
    await setBackfillState(env.DB, { page: 9, complete: true, last_error: null });

    const ctx = createExecutionContext();
    await worker.scheduled!(controller, env, ctx);
    await waitOnExecutionContext(ctx);

    expect((await getBackfillState(env.DB)).page).toBe(9);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run worker/scheduled.test.ts`
Expected: FAIL — `worker.scheduled` is undefined.

- [ ] **Step 3: Convert the default export to an object with `fetch` and `scheduled`**

Replace the tail of `worker/index.ts` (`export default app;`) with:

```ts
import { StravaClient } from "./strava/client";
import { runBackfill } from "./sync/backfill";

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const state = await getBackfillState(env.DB);
        if (state.complete) return;
        const client = await StravaClient.create(env);
        if (!client) return;
        await runBackfill(env, client);
      })().catch((err) => console.error("scheduled backfill failed", err)),
    );
  },
} satisfies ExportedHandler<Env>;

export { LiveRoom } from "./live/room";
```

Add the `getBackfillState` import at the top:

```ts
import { getBackfillState } from "./db/sync";
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run worker/scheduled.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the end-to-end pipeline test**

`worker/pipeline.test.ts`:

```ts
import { env, fetchMock, SELF } from "cloudflare:test";
import { describe, it, expect, beforeAll, afterEach, beforeEach } from "vitest";
import { signSession } from "./session";
import { saveAthlete } from "./db/athlete";
import type { LiveMessage } from "#shared/types";

beforeAll(() => {
  fetchMock.activate();
  fetchMock.disableNetConnect();
});
afterEach(() => fetchMock.assertNoPendingInterceptors());

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
  ]);
  await saveAthlete(env.DB, {
    id: 42, access_token: "good", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
  });
});

describe("webhook to websocket", () => {
  it("pushes an uploaded activity to a connected client", async () => {
    const cookie = `sd_session=${await signSession(42, env.SESSION_SECRET)}`;

    const upgrade = await SELF.fetch("http://example.com/live", {
      headers: { Cookie: cookie, Upgrade: "websocket" },
    });
    const ws = upgrade.webSocket;
    expect(ws).toBeTruthy();
    ws!.accept();

    const received = new Promise<string>((resolve) => {
      ws!.addEventListener("message", (e) => resolve(String(e.data)), { once: true });
    });

    fetchMock
      .get("https://www.strava.com")
      .intercept({ path: "/api/v3/activities/7", method: "GET" })
      .reply(200, {
        id: 7, name: "Evening Run", sport_type: "Run",
        start_date: "2026-09-05T16:41:00Z", start_date_local: "2026-09-05T18:41:00Z",
        elapsed_time: 2052, moving_time: 2052, distance: 6420,
      });

    const ack = await SELF.fetch("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object_type: "activity", object_id: 7, aspect_type: "create",
        owner_id: 42, subscription_id: 1, event_time: 1, updates: {},
      }),
    });
    expect(ack.status).toBe(200);

    const msg = JSON.parse(await received) as LiveMessage;
    expect(msg.type).toBe("activity.upsert");
    if (msg.type === "activity.upsert") {
      expect(msg.activity.name).toBe("Evening Run");
      expect(msg.activity.local_date).toBe("2026-09-05");
    }
  });
});
```

- [ ] **Step 6: Run the full suite**

Run: `pnpm test`
Expected: PASS, every test.

- [ ] **Step 7: Typecheck**

Run: `pnpm typecheck`
Expected: no errors. If `tsc -b` complains about unused destructured bindings in `api.ts`, the `_raw` / `_poly` prefix is what satisfies `noUnusedLocals`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add scheduled backfill resume and an end-to-end pipeline test"
```

---

## Spec coverage

Every section of the spec is either implemented here or explicitly assigned:

| Spec section | Where |
|---|---|
| §4.1 Connect | Task 5 |
| §4.2 Backfill | Task 6; scheduled resume in Task 11 |
| §4.3 Live ingest | Task 8 |
| §4.4 Live push | Tasks 7 and 9 |
| §4.5 Notification (Web Push) | **Plan 2** — needs the `push_subscriptions` table and VAPID secrets |
| §4.6 Coach | **Plan 3** — needs `ANTHROPIC_API_KEY` and `shared/aggregate.ts` |
| §5 Data model | Task 2 (minus `push_subscriptions`, see above) |
| §5 Where aggregation runs | Task 9 serves the slim rows; `shared/aggregate.ts` itself is **Plan 2** |
| §6 API surface | Task 9, minus `/api/coach` (Plan 3) and `/api/push/subscribe` (Plan 2) |
| §7 Frontend | **Plan 2** in full |
| §8 Error handling | Distributed across Tasks 4, 6, 7, 8 — every row of that table has a test |
| §9 Testing | Tasks 1–11; the `shared/aggregate.ts` and Playwright rows are **Plan 2** |
| §10 Configuration | Task 1 (bindings, assets, cron); VAPID and Anthropic secrets in Plans 2 and 3 |
| §11 Consequences | Dependencies and `wrangler.jsonc` in Task 1. **The `README.md` rewrite is deliberately left to the end of Plan 3**, when the stack it describes is actually all present — rewriting it now would replace one inaccurate README with another. |

## Manual verification

The automated suite never touches the real Strava API. Once every task is green, verify against the live service:

1. `pnpm db:migrate:local`
2. `pnpm dev` — the Worker and SPA come up together on <http://localhost:5173>
3. Visit `/auth/login`, complete the Strava consent screen. `GET /api/me` should report `connected: true` and the backfill should progress across calls.
4. In a second terminal: `cloudflared tunnel --url http://localhost:5173`
5. `pnpm webhook list`, delete any existing subscription, then `pnpm webhook create https://<tunnel-host>/webhook`
6. Upload an activity to Strava (or edit an existing one's title). With a browser tab open on the app, the WebSocket should carry an `activity.upsert` within a second or two.
7. Read your actual rate limits off <https://www.strava.com/settings/api> and confirm the backfill's pause threshold is sane for them.

## Definition of done

- `pnpm test` green; `pnpm typecheck` clean.
- An activity uploaded to Strava reaches an open tab over the WebSocket without a refresh.
- Killing and restarting the dev server mid-backfill resumes rather than restarting.
- A second Strava athlete attempting OAuth is refused with 403 and stores nothing.
