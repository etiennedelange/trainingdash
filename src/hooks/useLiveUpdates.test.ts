import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "vitest-browser-react";
import { createElement, type ReactNode } from "react";
import { useLiveUpdates } from "./useLiveUpdates";
import { queryKeys } from "@/lib/queries";

const fakeMe = {
  athleteId: 1, connected: true,
  backfill: { page: 1, complete: true, last_error: null },
  vapidPublicKey: "x",
};

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

let lastResult: ReturnType<typeof useLiveUpdates> | null = null;

function Probe() {
  lastResult = useLiveUpdates();
  return null;
}

let client: QueryClient;

beforeEach(() => {
  client = new QueryClient();
  // The live socket only connects once a session is known to exist — prime
  // meQuery so authenticated is true immediately in tests that don't care
  // about the logged-out gating itself (that gets its own test below).
  client.setQueryData(queryKeys.me, fakeMe);
  FakeSocket.last = null;
  lastResult = null;
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
      data: JSON.stringify({ type: "activity.upsert", activity: { id: 1 }, aspect: "create" }),
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

  it("sets a persistent hero activity on upsert, cleared by dismissHero", async () => {
    const Wrapper = wrap(client);
    const screen = await render(createElement(Wrapper, null, createElement(Probe)));

    FakeSocket.last?.onmessage?.({
      data: JSON.stringify({
        type: "activity.upsert",
        activity: { id: 42, name: "Run" },
        aspect: "create",
      }),
    });
    await screen.rerender(createElement(Wrapper, null, createElement(Probe)));
    expect(lastResult?.heroArrival?.id).toBe(42);
    expect(lastResult?.heroArrival?.name).toBe("Run");

    lastResult?.dismissHero();
    await screen.rerender(createElement(Wrapper, null, createElement(Probe)));
    expect(lastResult?.heroArrival).toBeNull();
  });

  it("flags an update as updatedIds, not arrivedIds/hero, and skips the toast name", async () => {
    const Wrapper = wrap(client);
    const screen = await render(createElement(Wrapper, null, createElement(Probe)));

    FakeSocket.last?.onmessage?.({
      data: JSON.stringify({
        type: "activity.upsert",
        activity: { id: 7, name: "Renamed Run" },
        aspect: "update",
      }),
    });
    await screen.rerender(createElement(Wrapper, null, createElement(Probe)));

    expect(lastResult?.updatedIds.has(7)).toBe(true);
    expect(lastResult?.arrivedIds.has(7)).toBe(false);
    expect(lastResult?.heroArrival).toBeNull();
    expect(lastResult?.lastArrivalName).toBeNull();
  });

  it("never opens the socket while there is no session", async () => {
    const freshClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    vi.stubGlobal("fetch", async () => new Response("unauthorized", { status: 401 }));
    const Wrapper = wrap(freshClient);
    await render(createElement(Wrapper, null, createElement(Probe)));
    await expect.poll(() => lastResult?.authenticated).toBe(false);
    expect(FakeSocket.last).toBeNull();
    expect(lastResult?.connected).toBe(false);
  });
});
