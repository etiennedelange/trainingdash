import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import { createElement, act } from "react";
import { useCoachStream } from "./useCoachStream";

afterEach(() => vi.unstubAllGlobals());

// vitest-browser-react mounts into a real Chromium tab via
// ReactDOMClient.createRoot, and resets the act environment flag back to
// false once its own `render()` call settles. Without wrapping `ask()` in
// `act()` here (with the flag re-declared right before it), React
// schedules the state updates it triggers on the concurrent scheduler and
// never flushes them before our assertions run, since we only ever yield
// microtasks (awaited promises), not the scheduler's macrotask tick.
async function flush(run: () => Promise<void>) {
  (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  await act(run);
}

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
      c.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

let api: ReturnType<typeof useCoachStream>;
function Probe() {
  api = useCoachStream();
  return null;
}

describe("useCoachStream", () => {
  it("accumulates text deltas into one assistant turn", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      sseResponse(['data: {"text":"You ran "}\n\n', 'data: {"text":"32 km."}\n\n', "data: [DONE]\n\n"]),
    ));

    await render(createElement(Probe));
    await flush(() => api.ask("How was my week?", "2026-09-06"));

    expect(api.turns).toHaveLength(2);
    expect(api.turns[0]).toMatchObject({ role: "user", content: "How was my week?" });
    expect(api.turns[1]).toMatchObject({ role: "assistant", content: "You ran 32 km." });
  });

  it("surfaces a transport failure without losing the question", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    await render(createElement(Probe));
    await flush(() => api.ask("hi", "2026-09-06"));

    expect(api.error).toBeTruthy();
    expect(api.turns[0]).toMatchObject({ role: "user", content: "hi" });
  });

  it("ignores an empty question", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    await render(createElement(Probe));
    await api.ask("   ", "2026-09-06");
    expect(spy).not.toHaveBeenCalled();
  });
});
