import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { saveAthlete } from "../db/athlete";
import { getActivity } from "../db/activities";

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
  beforeEach(async () => {
    await env.DB.batch([
      env.DB.prepare("DELETE FROM athlete"),
      env.DB.prepare("DELETE FROM activities"),
    ]);
  });

  it("acknowledges immediately with 200", async () => {
    const res = await SELF.fetch(
      `http://example.com/webhook?token=${env.STRAVA_VERIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_type: "activity", object_id: 1, aspect_type: "create",
          owner_id: 42, subscription_id: 1, event_time: 1, updates: {},
        }),
      },
    );
    expect(res.status).toBe(200);
  });

  it("still returns 200 on a malformed body", async () => {
    const res = await SELF.fetch(
      `http://example.com/webhook?token=${env.STRAVA_VERIFY_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      },
    );
    expect(res.status).toBe(200);
  });

  it("acks with 200 but does not process a delete when the token is missing or wrong", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r",
      expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
    });
    await env.DB
      .prepare(
        `INSERT INTO activities (id, name, sport_type, start_date, local_date,
           elapsed_time, moving_time, distance, raw, updated_at)
         VALUES (7, 'Evening Run', 'Run', '2026-09-05T16:41:00Z', '2026-09-05',
           100, 100, 1000, '{}', 1)`,
      )
      .run();

    const forge = (query: string) =>
      SELF.fetch(`http://example.com/webhook${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          object_type: "activity", object_id: 7, aspect_type: "delete",
          owner_id: 42, subscription_id: 1, event_time: 1, updates: {},
        }),
      });

    expect((await forge("")).status).toBe(200);
    expect((await forge("?token=wrong")).status).toBe(200);

    // The forged deletes were acked but never processed: the row survives.
    expect(await getActivity(env.DB, 7)).not.toBeNull();
  });
});
