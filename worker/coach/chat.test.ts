import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { streamCoachReply } from "./chat";
import { env } from "cloudflare:test";

// NOTE ON MOCKING STRATEGY
//
// This test originally mocked `@anthropic-ai/sdk` with `vi.mock`. That
// worked while `chat.ts` was only reachable via a direct import from this
// test file. Once Task 3 mounted `worker/routes/coach.ts` (which imports
// `./chat`) into `worker/routes/api.ts` — the worker's always-loaded
// entrypoint — `@anthropic-ai/sdk` became reachable from the worker's own
// bundled module graph, and `vi.mock` no longer intercepts it: confirmed by
// bisecting to commit 3641ed7 (passes) vs db45d24 (fails with a real 401
// from api.anthropic.com — the mock is silently not applied and the real
// SDK makes a real network call). This is the same limitation already
// documented in worker/strava/client.test.ts and rediscovered independently
// for this feature in worker/routes/coach.test.ts.
//
// Instead, this test stubs the global `fetch` and intercepts the outbound
// call to api.anthropic.com, capturing the request body and returning a
// canned response in Anthropic's real SSE wire format, so the real
// `streamCoachReply` and the real Anthropic SDK run unmodified end to end.

let lastRequestBody: string | undefined;
let sseResponse = "";

async function mockFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = new URL(typeof input === "string" ? input : (input as URL | Request).toString());
  if (url.hostname !== "api.anthropic.com") {
    throw new Error(`Unexpected fetch: ${url}`);
  }
  lastRequestBody = typeof init?.body === "string" ? init.body : undefined;
  return new Response(sseResponse, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

function sseFrame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function fakeSse(): string {
  return (
    sseFrame("content_block_delta", {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "You ran " },
    }) +
    sseFrame("content_block_delta", {
      type: "content_block_delta",
      index: 0,
      delta: { type: "text_delta", text: "32 km." },
    }) +
    sseFrame("message_stop", { type: "message_stop" })
  );
}

beforeEach(() => {
  lastRequestBody = undefined;
  sseResponse = fakeSse();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function body(): Record<string, unknown> {
  if (!lastRequestBody) throw new Error("no request captured");
  return JSON.parse(lastRequestBody) as Record<string, unknown>;
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

describe("streamCoachReply", () => {
  it("uses claude-opus-5", async () => {
    await streamCoachReply(env.ANTHROPIC_API_KEY, "DIGEST", [{ role: "user", content: "hi" }]);
    expect(body()).toMatchObject({ model: "claude-opus-5" });
  });

  it("streams", async () => {
    await streamCoachReply(env.ANTHROPIC_API_KEY, "DIGEST", [{ role: "user", content: "hi" }]);
    expect(body()).toMatchObject({ stream: true });
  });

  it("uses adaptive thinking and never sends budget_tokens", async () => {
    await streamCoachReply(env.ANTHROPIC_API_KEY, "DIGEST", [{ role: "user", content: "hi" }]);
    const params = body();
    expect(params.thinking).toEqual({ type: "adaptive" });
    // budget_tokens is removed on Opus 5 and returns a 400.
    expect(lastRequestBody).not.toContain("budget_tokens");
  });

  it("sends no assistant prefill — the last turn is always the user's", async () => {
    await streamCoachReply(env.ANTHROPIC_API_KEY, "DIGEST", [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "and?" },
    ]);
    const params = body() as { messages: { role: string }[] };
    expect(params.messages[params.messages.length - 1]?.role).toBe("user");
  });

  it("puts the digest in the cached system prefix, not in the messages", async () => {
    await streamCoachReply(env.ANTHROPIC_API_KEY, "DIGEST-MARKER", [{ role: "user", content: "hi" }]);
    const params = body() as {
      system: { type: string; text: string; cache_control?: unknown }[];
      messages: { content: string }[];
    };
    const systemText = params.system.map((b) => b.text).join("\n");
    expect(systemText).toContain("DIGEST-MARKER");
    expect(params.messages.some((m) => m.content.includes("DIGEST-MARKER"))).toBe(false);
    // The last system block carries the breakpoint so the whole prefix caches.
    expect(params.system[params.system.length - 1]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("emits the text deltas as SSE data lines", async () => {
    const stream = await streamCoachReply(env.ANTHROPIC_API_KEY, "DIGEST", [{ role: "user", content: "hi" }]);
    const text = await drain(stream);
    expect(text).toContain("You ran ");
    expect(text).toContain("32 km.");
    expect(text).toContain("data: ");
  });
});
