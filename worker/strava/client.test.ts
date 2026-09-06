import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StravaClient, parseRateLimit, isNearLimit, RateLimitError } from "./client";
import { saveAthlete, getAthlete } from "../db/athlete";

// NOTE ON MOCKING STRATEGY
//
// The task brief specifies mocking Strava's API with `fetchMock` imported
// from `cloudflare:test`. That export does not exist at runtime in the
// installed `@cloudflare/vitest-pool-workers@0.22.0`: the type declaration
// file (types/cloudflare-test.d.ts) still documents a `MockAgent`-shaped
// `fetchMock`, but the actual module (dist/worker/lib/cloudflare/test.mjs)
// never exports it — `import { fetchMock } from "cloudflare:test"` silently
// resolves to `undefined`, confirmed by running the brief's test verbatim
// (`fetchMock.activate()` throws "Cannot read properties of undefined").
// grep across node_modules/@cloudflare/vitest-pool-workers and
// node_modules/.pnpm/miniflare* turned up no trace of a `fetchMock` runtime
// implementation or replacement export anywhere in this dependency tree.
//
// Instead, this test stubs the global `fetch` directly with
// `vi.stubGlobal("fetch", ...)`, confirmed to work inside the
// vitest-pool-workers runtime with a standalone probe test before writing
// this file. `expectFetch()` queues an expected request (path + method) and
// the canned response to return for it; `afterEach` asserts the queue was
// fully drained, mirroring `fetchMock.assertNoPendingInterceptors()`. An
// unmatched request throws, mirroring `fetchMock.disableNetConnect()`.

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
  await env.DB.prepare("DELETE FROM athlete").run();
  queue = [];
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  expect(queue).toEqual([]);
  vi.unstubAllGlobals();
});

const NOW = () => Math.floor(Date.now() / 1000);

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

  it("returns null when a header value is non-numeric", () => {
    const h = new Headers({
      "X-RateLimit-Limit": "abc,600",
      "X-RateLimit-Usage": "300,15000",
    });
    expect(parseRateLimit(h)).toBeNull();
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
    expectFetch({ path: "/api/v3/activities/7", method: "GET", status: 200, body: { id: 7, name: "Run" } });

    const client = await StravaClient.create(env);
    expect((await client!.getActivity(7)).id).toBe(7);
  });

  it("refreshes an expired token and persists the new pair", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "stale", refresh_token: "r0", expires_at: NOW() - 10, connected: true,
    });
    expectFetch({
      path: "/oauth/token", method: "POST", status: 200,
      body: { access_token: "fresh", refresh_token: "r1", expires_at: NOW() + 3600 },
    });
    expectFetch({ path: "/api/v3/activities/7", method: "GET", status: 200, body: { id: 7, name: "Run" } });

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
    expectFetch({ path: "/oauth/token", method: "POST", status: 400, body: { message: "Bad Request" } });

    await expect(StravaClient.create(env)).rejects.toThrow();
    expect((await getAthlete(env.DB))?.connected).toBe(false);
  });

  it("throws RateLimitError on a 429", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r", expires_at: NOW() + 3600, connected: true,
    });
    expectFetch({ path: "/api/v3/activities/7", method: "GET", status: 429, body: {} });

    const client = await StravaClient.create(env);
    await expect(client!.getActivity(7)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("records the rate limit from the last response", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "good", refresh_token: "r", expires_at: NOW() + 3600, connected: true,
    });
    expectFetch({
      path: "/api/v3/athlete/activities?page=1&per_page=200", method: "GET", status: 200,
      body: [{ id: 1 }],
      headers: { "X-RateLimit-Limit": "600,30000", "X-RateLimit-Usage": "10,20" },
    });

    const client = await StravaClient.create(env);
    await client!.listActivities(1, 200);
    expect(client!.lastRateLimit?.shortUsage).toBe(10);
  });
});
