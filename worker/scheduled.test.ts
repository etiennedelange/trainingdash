import { env, createExecutionContext, waitOnExecutionContext } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import worker from "./index";
import { saveAthlete } from "./db/athlete";
import { setBackfillState, getBackfillState } from "./db/sync";
import { listActivities } from "./db/activities";

// See worker/strava/client.test.ts for the note on why this test stubs the
// global `fetch` instead of using the brief's `fetchMock` (which does not
// exist at runtime in the installed @cloudflare/vitest-pool-workers).

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

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  queue = [];
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  expect(queue).toEqual([]);
  vi.unstubAllGlobals();
});

const controller = { cron: "0 * * * *", scheduledTime: Date.now(), noRetry: () => {} };

describe("scheduled", () => {
  it("resumes an incomplete backfill", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
    });
    await setBackfillState(env.DB, { page: 2, complete: false, last_error: "rate limit reached" });

    expectFetch({
      path: "/api/v3/athlete/activities?page=2&per_page=200", method: "GET", status: 200,
      body: [{
        id: 5, name: "Run", sport_type: "Run",
        start_date: "2026-09-05T16:41:00Z", start_date_local: "2026-09-05T18:41:00Z",
        elapsed_time: 1, moving_time: 1, distance: 1,
      }],
    });
    // runBackfill only marks itself complete on an EMPTY page (a short page
    // can still be non-final in principle — see worker/sync/backfill.ts),
    // so a single non-empty page here is not enough to reach complete:true;
    // the resume loop makes one further request for page 3.
    expectFetch({
      path: "/api/v3/athlete/activities?page=3&per_page=200", method: "GET", status: 200,
      body: [],
    });

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
    // No fetch expectations queued; afterEach would fail on an unmatched call.
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
