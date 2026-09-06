import { env, SELF } from "cloudflare:test";
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { getAthlete } from "../db/athlete";

// NOTE ON MOCKING STRATEGY
//
// As in worker/strava/client.test.ts, `fetchMock` from `cloudflare:test` does
// not exist at runtime in the installed `@cloudflare/vitest-pool-workers`.
// This test stubs the global `fetch` directly with `vi.stubGlobal`, using the
// same `expectFetch`/`mockFetch` queue pattern established there.

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
    expectFetch({
      path: "/oauth/token",
      method: "POST",
      status: 200,
      body: tokenReply(42),
    });

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
    expectFetch({
      path: "/oauth/token",
      method: "POST",
      status: 200,
      body: tokenReply(42),
    });
    await SELF.fetch("http://example.com/auth/callback?code=xyz", { redirect: "manual" });

    expectFetch({
      path: "/oauth/token",
      method: "POST",
      status: 200,
      body: tokenReply(99),
    });
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
