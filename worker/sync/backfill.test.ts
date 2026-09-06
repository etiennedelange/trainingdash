import { env } from "cloudflare:test";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { runBackfill } from "./backfill";
import { StravaClient } from "../strava/client";
import { saveAthlete } from "../db/athlete";
import { setBackfillState } from "../db/sync";
import { listActivities } from "../db/activities";

// NOTE ON MOCKING STRATEGY
//
// As in worker/strava/client.test.ts and worker/routes/auth.test.ts,
// `fetchMock` from `cloudflare:test` does not exist at runtime in the
// installed `@cloudflare/vitest-pool-workers`. This test stubs the global
// `fetch` directly with `vi.stubGlobal`, using the same
// `expectFetch`/`mockFetch` queue pattern established there, with an
// optional `headers` field to simulate Strava's rate-limit headers.

interface QueuedCall {
  path: string;
  method: string;
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

let queue: QueuedCall[] = [];

function expectFetch(call: QueuedCall): void {
  queue.push(call);
}

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : (input as URL | Request).toString());
  const method = (init?.method ?? "GET").toUpperCase();
  const path = url.pathname + url.search;
  const idx = queue.findIndex((c) => c.path === path && c.method === method);
  if (idx === -1) {
    throw new Error(`Unexpected fetch: ${method} ${path} (no matching expectation queued)`);
  }
  const call = queue.splice(idx, 1)[0]!;
  return new Response(JSON.stringify(call.body), {
    status: call.status,
    headers: call.headers,
  });
}

const act = (id: number) => ({
  id,
  name: `Run ${id}`,
  sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z",
  start_date_local: "2026-09-05T18:41:00Z",
  elapsed_time: 100,
  moving_time: 100,
  distance: 1000,
});

const page = (n: number) => `/api/v3/athlete/activities?page=${n}&per_page=200`;

beforeEach(async () => {
  queue = [];
  vi.stubGlobal("fetch", mockFetch);
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  await saveAthlete(env.DB, {
    id: 42,
    access_token: "good",
    refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    connected: true,
  });
});

afterEach(() => {
  expect(queue).toEqual([]);
  vi.unstubAllGlobals();
});

describe("runBackfill", () => {
  it("pages until a short page and marks itself complete", async () => {
    expectFetch({ path: page(1), method: "GET", status: 200, body: [act(1), act(2)] });
    expectFetch({ path: page(2), method: "GET", status: 200, body: [] });

    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);

    expect(state.complete).toBe(true);
    expect(await listActivities(env.DB)).toHaveLength(2);
  });

  it("stops on a 429 and saves the page to resume from", async () => {
    expectFetch({ path: page(1), method: "GET", status: 200, body: [act(1)] });
    expectFetch({ path: page(2), method: "GET", status: 429, body: {} });

    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);

    expect(state.complete).toBe(false);
    expect(state.page).toBe(2);
    expect(state.last_error).toContain("rate limit");
    expect(await listActivities(env.DB)).toHaveLength(1);
  });

  it("resumes from the saved page rather than restarting", async () => {
    await setBackfillState(env.DB, { page: 3, complete: false, last_error: null });
    expectFetch({ path: page(3), method: "GET", status: 200, body: [act(9)] });
    expectFetch({ path: page(4), method: "GET", status: 200, body: [] });

    const client = await StravaClient.create(env);
    await runBackfill(env, client!);

    expect((await listActivities(env.DB)).map((a) => a.id)).toEqual([9]);
  });

  it("does nothing once complete", async () => {
    await setBackfillState(env.DB, { page: 7, complete: true, last_error: null });
    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);
    expect(state.complete).toBe(true);
    // No interceptors registered — the afterEach empty-queue assertion would
    // fail on an unexpected call.
  });

  it("stops early when the rate limit is nearly exhausted", async () => {
    expectFetch({
      path: page(1),
      method: "GET",
      status: 200,
      body: [act(1)],
      headers: { "X-RateLimit-Limit": "600,30000", "X-RateLimit-Usage": "595,100" },
    });

    const client = await StravaClient.create(env);
    const state = await runBackfill(env, client!);

    expect(state.complete).toBe(false);
    expect(state.page).toBe(2);
    expect(await listActivities(env.DB)).toHaveLength(1);
  });
});
