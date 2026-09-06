import { env } from "cloudflare:test";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { handleEvent } from "./ingest";
import { saveAthlete } from "../db/athlete";
import { upsertActivity, getActivity } from "../db/activities";
import type { StravaWebhookEvent } from "./ingest";

// NOTE ON MOCKING STRATEGY
//
// The task brief specifies mocking Strava's API with `fetchMock` imported
// from `cloudflare:test`. That export does not exist at runtime in the
// installed `@cloudflare/vitest-pool-workers@0.22.0` (confirmed independently
// in worker/strava/client.test.ts across Tasks 4-6). This file reuses that
// same adaptation: stub the global `fetch` directly with
// `vi.stubGlobal("fetch", ...)`. `expectFetch()` queues an expected request
// (path + method) and the canned response to return for it; `afterEach`
// asserts the queue was fully drained, mirroring
// `fetchMock.assertNoPendingInterceptors()`. An unmatched request throws,
// mirroring `fetchMock.disableNetConnect()`.

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

beforeEach(() => {
  queue = [];
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  expect(queue).toEqual([]);
  vi.unstubAllGlobals();
});

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
    expectFetch({ path: "/api/v3/activities/7", method: "GET", status: 200, body: activity });

    await handleEvent(env, event());
    expect((await getActivity(env.DB, 7))?.name).toBe("Evening Run");
  });

  it("refetches on update, overwriting the stored row", async () => {
    await upsertActivity(env.DB, row);
    expectFetch({
      path: "/api/v3/activities/7", method: "GET", status: 200,
      body: { ...activity, name: "Renamed" },
    });

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
