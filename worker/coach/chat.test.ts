import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamCoachReply } from "./chat";
import { env } from "cloudflare:test";

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: (...args: unknown[]) => create(...args) };
  },
}));

function fakeStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "You ran " },
      });
      controller.enqueue({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "32 km." },
      });
      controller.close();
    },
  });
}

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue(fakeStream());
});

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

describe("streamCoachReply", () => {
  it("uses claude-opus-5", async () => {
    await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ model: "claude-opus-5" });
  });

  it("streams", async () => {
    await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ stream: true });
  });

  it("uses adaptive thinking and never sends budget_tokens", async () => {
    await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params.thinking).toEqual({ type: "adaptive" });
    // budget_tokens is removed on Opus 5 and returns a 400.
    expect(JSON.stringify(params)).not.toContain("budget_tokens");
  });

  it("sends no assistant prefill — the last turn is always the user's", async () => {
    await streamCoachReply(env, "DIGEST", [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "and?" },
    ]);
    const params = create.mock.calls[0]?.[0] as { messages: { role: string }[] };
    expect(params.messages[params.messages.length - 1]?.role).toBe("user");
  });

  it("puts the digest in the cached system prefix, not in the messages", async () => {
    await streamCoachReply(env, "DIGEST-MARKER", [{ role: "user", content: "hi" }]);
    const params = create.mock.calls[0]?.[0] as {
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
    const stream = await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    const text = await drain(stream);
    expect(text).toContain("You ran ");
    expect(text).toContain("32 km.");
    expect(text).toContain("data: ");
  });
});
