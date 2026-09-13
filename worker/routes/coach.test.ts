import { env, SELF } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { signSession } from "../session";
import { saveAthlete } from "../db/athlete";

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

beforeEach(async () => {
  lastRequestBody = undefined;
  vi.stubGlobal("fetch", mockFetch);
  await env.DB.prepare("DELETE FROM athlete").run();
  await saveAthlete(env.DB, {
    id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
  });
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

  it("accepts a long past assistant turn (only user turns are length-capped)", async () => {
    const longAssistantReply = "a".repeat(5000);
    const res = await post({
      turns: [
        { role: "user", content: "How was my week?" },
        { role: "assistant", content: longAssistantReply },
        { role: "user", content: "And my longest run?" },
      ],
      today: "2026-09-06",
    });
    expect(res.status).toBe(200);
  });

  it("412s with no_api_key when no key is stored and the env has none either", async () => {
    const original = env.ANTHROPIC_API_KEY;
    env.ANTHROPIC_API_KEY = "";
    try {
      const res = await post(valid);
      expect(res.status).toBe(412);
      expect(await res.json()).toEqual({ error: "no_api_key" });
    } finally {
      env.ANTHROPIC_API_KEY = original;
    }
  });

  it("uses the stored BYOK key over the env fallback when both exist", async () => {
    await SELF.fetch("http://example.com/api/coach/key", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Cookie: `sd_session=${await signSession(42, env.SESSION_SECRET)}`,
      },
      body: JSON.stringify({ apiKey: "sk-ant-abcdefghijklmnop" }),
    });
    const res = await post(valid);
    expect(res.status).toBe(200);
  });
});

async function keyRequest(method: string, body?: unknown, withSession = true): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSession) headers.Cookie = `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
  return await SELF.fetch("http://example.com/api/coach/key", {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

describe("GET/PUT/DELETE /api/coach/key", () => {
  it("401s without a session", async () => {
    expect((await keyRequest("GET", undefined, false)).status).toBe(401);
  });

  it("falls back to the env key by default, with no stored BYOK key", async () => {
    const res = await keyRequest("GET");
    expect(await res.json()).toEqual({ hasKey: true, source: "env" });
  });

  it("reports no key at all when neither a stored key nor the env fallback exists", async () => {
    const original = env.ANTHROPIC_API_KEY;
    env.ANTHROPIC_API_KEY = "";
    try {
      expect(await (await keyRequest("GET")).json()).toEqual({ hasKey: false, source: "none" });
    } finally {
      env.ANTHROPIC_API_KEY = original;
    }
  });

  it("rejects a value that doesn't look like an Anthropic key", async () => {
    const res = await keyRequest("PUT", { apiKey: "not-a-key" });
    expect(res.status).toBe(400);
  });

  it("saves a key, then reports it as the byok source, then clears it back to env", async () => {
    const put = await keyRequest("PUT", { apiKey: "sk-ant-abcdefghijklmnop" });
    expect(put.status).toBe(200);
    expect(await (await keyRequest("GET")).json()).toEqual({ hasKey: true, source: "byok" });

    const del = await keyRequest("DELETE");
    expect(del.status).toBe(200);
    expect(await (await keyRequest("GET")).json()).toEqual({ hasKey: true, source: "env" });
  });
});
