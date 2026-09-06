import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "vitest-browser-react";
import { createElement, type ReactNode } from "react";
import { useLiveUpdates } from "./useLiveUpdates";

class FakeSocket {
  static last: FakeSocket | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  close = vi.fn();
  constructor(readonly url: string) {
    FakeSocket.last = this;
  }
}

function wrap(client: QueryClient) {
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client }, children);
}

function Probe() {
  useLiveUpdates();
  return null;
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  FakeSocket.last = null;
  vi.stubGlobal("WebSocket", FakeSocket);
});
afterEach(() => vi.unstubAllGlobals());

describe("useLiveUpdates", () => {
  it("connects to /live on the current origin", async () => {
    const Wrapper = wrap(client);
    await render(createElement(Wrapper, null, createElement(Probe)));
    expect(FakeSocket.last?.url).toMatch(/\/live$/);
    expect(FakeSocket.last?.url).toMatch(/^wss?:/);
  });

  it("invalidates the activities cache on an upsert message", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const Wrapper = wrap(client);
    await render(createElement(Wrapper, null, createElement(Probe)));

    FakeSocket.last?.onmessage?.({
      data: JSON.stringify({ type: "activity.upsert", activity: { id: 1 } }),
    });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["activities"] });
  });

  it("refetches on reconnect", async () => {
    const spy = vi.spyOn(client, "invalidateQueries");
    const Wrapper = wrap(client);
    await render(createElement(Wrapper, null, createElement(Probe)));

    FakeSocket.last?.onopen?.();
    expect(spy).toHaveBeenCalledWith({ queryKey: ["activities"] });
  });

  it("ignores a message that is not valid JSON", async () => {
    const Wrapper = wrap(client);
    await render(createElement(Wrapper, null, createElement(Probe)));
    expect(() => FakeSocket.last?.onmessage?.({ data: "garbage" })).not.toThrow();
  });
});
