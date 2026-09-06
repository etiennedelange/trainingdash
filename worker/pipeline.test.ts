import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { signSession } from "./session";
import { saveAthlete } from "./db/athlete";
import type { LiveMessage } from "#shared/types";

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
  ]);
  await saveAthlete(env.DB, {
    id: 42, access_token: "good", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
  });
  queue = [];
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  expect(queue).toEqual([]);
  vi.unstubAllGlobals();
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

    expectFetch({
      path: "/api/v3/activities/7", method: "GET", status: 200,
      body: {
        id: 7, name: "Evening Run", sport_type: "Run",
        start_date: "2026-09-05T16:41:00Z", start_date_local: "2026-09-05T18:41:00Z",
        elapsed_time: 2052, moving_time: 2052, distance: 6420,
      },
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
