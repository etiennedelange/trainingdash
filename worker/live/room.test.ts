import { env } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import type { LiveMessage } from "#shared/types";

function connect(name = "live"): Promise<WebSocket> {
  const stub = env.LIVE.getByName(name);
  return stub
    .fetch("http://do/connect", { headers: { Upgrade: "websocket" } })
    .then((res) => {
      const ws = res.webSocket;
      if (!ws) throw new Error("no websocket on the response");
      ws.accept();
      return ws;
    });
}

function nextMessage(ws: WebSocket): Promise<string> {
  return new Promise((resolve) => {
    ws.addEventListener("message", (e) => resolve(String(e.data)), { once: true });
  });
}

const msg: LiveMessage = { type: "activity.delete", id: 7 };

describe("LiveRoom", () => {
  it("refuses a non-upgrade request to /connect", async () => {
    const stub = env.LIVE.getByName("t-refuse");
    const res = await stub.fetch("http://do/connect");
    expect(res.status).toBe(426);
  });

  it("delivers a broadcast to a connected socket", async () => {
    const stub = env.LIVE.getByName("t-one");
    const ws = await connect("t-one");

    const received = nextMessage(ws);
    await stub.fetch("http://do/broadcast", { method: "POST", body: JSON.stringify(msg) });

    expect(JSON.parse(await received)).toEqual(msg);
  });

  it("delivers to every connected socket", async () => {
    const stub = env.LIVE.getByName("t-many");
    const a = await connect("t-many");
    const b = await connect("t-many");

    const both = Promise.all([nextMessage(a), nextMessage(b)]);
    await stub.fetch("http://do/broadcast", { method: "POST", body: JSON.stringify(msg) });

    const [ra, rb] = await both;
    expect(JSON.parse(ra)).toEqual(msg);
    expect(JSON.parse(rb)).toEqual(msg);
  });

  it("reports how many sockets a broadcast reached", async () => {
    const stub = env.LIVE.getByName("t-count");
    const res = await stub.fetch("http://do/broadcast", {
      method: "POST",
      body: JSON.stringify(msg),
    });
    expect(await res.json()).toEqual({ delivered: 0 });
  });

  it("404s an unknown path", async () => {
    const stub = env.LIVE.getByName("t-404");
    expect((await stub.fetch("http://do/nope")).status).toBe(404);
  });
});
