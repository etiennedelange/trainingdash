import { env, SELF } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signSession } from "../session";

// NOTE ON MOCKING STRATEGY
//
// The task brief mocks `../coach/chat` with `vi.mock`, expecting it to
// intercept `streamCoachReply` when the route handler — running inside the
// SELF-fetched worker — imports it. Confirmed by running the brief's test
// verbatim (with a `console.error` probe inside the mock factory) that the
// factory is never invoked: `SELF.fetch` dispatches into the worker's own
// pre-bundled module graph, which vitest's module-mocking transform never
// touches. This is the same limitation already documented in
// worker/strava/client.test.ts and worker/pipeline.test.ts for the brief's
// `fetchMock` — confirmed not to exist at runtime in the installed
// `@cloudflare/vitest-pool-workers@0.22.0`.
//
// Instead, this test stubs the global `fetch` (the same technique those
// other tests use) and intercepts the outbound call `streamCoachReply` makes
// to api.anthropic.com, returning a canned response in Anthropic's SSE wire
// format so the real `streamCoachReply` (and the real Anthropic SDK) run
// unmodified end to end.

let lastRequestBody: string | undefined;

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : (input as URL | Request).toString());
  if (url.hostname !== "api.anthropic.com") {
    throw new Error(`Unexpected fetch: ${url}`);
  }
  lastRequestBody = typeof init?.body === "string" ? init.body : undefined;
  const sse =
    `event: content_block_delta\n` +
    `data: ${JSON.stringify({ type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "ok" } })}\n\n` +
    `event: message_stop\n` +
    `data: ${JSON.stringify({ type: "message_stop" })}\n\n`;
  return new Response(sse, { status: 200, headers: { "content-type": "text/event-stream" } });
}

beforeEach(() => {
  lastRequestBody = undefined;
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function post(body: unknown, withSession = true): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSession) headers.Cookie = `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
  return await SELF.fetch("http://example.com/api/coach", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const valid = { turns: [{ role: "user", content: "How was my week?" }], today: "2026-09-06" };

describe("POST /api/coach", () => {
  it("401s without a session", async () => {
    expect((await post(valid, false)).status).toBe(401);
    expect(lastRequestBody).toBeUndefined();
  });

  it("streams a reply as SSE", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await res.text()).toContain('"text":"ok"');
  });

  it("builds the digest server-side and ignores any digest in the body", async () => {
    await post({ ...valid, digest: "INJECTED" });
    expect(lastRequestBody).not.toContain("INJECTED");
    expect(lastRequestBody).toContain("Training summary");
  });

  it("400s an empty turn list", async () => {
    expect((await post({ turns: [], today: "2026-09-06" })).status).toBe(400);
  });

  it("400s when the last turn is not the user's", async () => {
    const res = await post({
      turns: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
      today: "2026-09-06",
    });
    expect(res.status).toBe(400);
  });

  it("400s a malformed today", async () => {
    expect((await post({ ...valid, today: "not-a-date" })).status).toBe(400);
  });
});
