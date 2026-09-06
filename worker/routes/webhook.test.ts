import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("GET /webhook (subscription validation)", () => {
  it("echoes hub.challenge as JSON when the verify token matches", async () => {
    const q = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": env.STRAVA_VERIFY_TOKEN,
      "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3",
    });
    const res = await SELF.fetch(`http://example.com/webhook?${q}`);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({
      "hub.challenge": "15f7d1a91c1f40f8a748fd134752feb3",
    });
  });

  it("refuses a wrong verify token", async () => {
    const q = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.verify_token": "wrong",
      "hub.challenge": "abc",
    });
    expect((await SELF.fetch(`http://example.com/webhook?${q}`)).status).toBe(403);
  });
});

describe("POST /webhook", () => {
  it("acknowledges immediately with 200", async () => {
    const res = await SELF.fetch("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        object_type: "activity", object_id: 1, aspect_type: "create",
        owner_id: 42, subscription_id: 1, event_time: 1, updates: {},
      }),
    });
    expect(res.status).toBe(200);
  });

  it("still returns 200 on a malformed body", async () => {
    const res = await SELF.fetch("http://example.com/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    expect(res.status).toBe(200);
  });
});
