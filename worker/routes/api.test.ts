import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { signSession } from "../session";
import { saveAthlete } from "../db/athlete";
import { upsertActivity } from "../db/activities";

const row = {
  id: 7, name: "Evening Run", sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z", local_date: "2026-09-05",
  elapsed_time: 100, moving_time: 100, distance: 1000,
  total_elevation_gain: null, average_speed: null, average_heartrate: null,
  suffer_score: null, polyline: "poly", raw: '{"id":7}', updated_at: 1,
};

async function cookie(): Promise<string> {
  return `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
}

beforeEach(async () => {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM athlete"),
    env.DB.prepare("DELETE FROM activities"),
    env.DB.prepare("DELETE FROM sync_state"),
  ]);
  await saveAthlete(env.DB, {
    id: 42, access_token: "a", refresh_token: "r",
    expires_at: Math.floor(Date.now() / 1000) + 3600, connected: true,
  });
});

describe("/api guard", () => {
  it("401s without a session cookie", async () => {
    expect((await SELF.fetch("http://example.com/api/me")).status).toBe(401);
  });

  it("401s on a forged cookie", async () => {
    const res = await SELF.fetch("http://example.com/api/me", {
      headers: { Cookie: "sd_session=42.deadbeef" },
    });
    expect(res.status).toBe(401);
  });
});

describe("/api/me", () => {
  it("reports connection state and backfill progress", async () => {
    const res = await SELF.fetch("http://example.com/api/me", {
      headers: { Cookie: await cookie() },
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      athleteId: 42,
      connected: true,
      backfill: { page: 1, complete: false, last_error: null },
    });
  });
});

describe("/api/activities", () => {
  it("omits raw and polyline from the list", async () => {
    await upsertActivity(env.DB, row);
    const res = await SELF.fetch("http://example.com/api/activities", {
      headers: { Cookie: await cookie() },
    });
    const body = (await res.json()) as Record<string, unknown>[];
    expect(body).toHaveLength(1);
    expect(body[0]).not.toHaveProperty("raw");
    expect(body[0]).not.toHaveProperty("polyline");
    expect(body[0]?.name).toBe("Evening Run");
  });

  it("returns one activity in full, including the polyline", async () => {
    await upsertActivity(env.DB, row);
    const res = await SELF.fetch("http://example.com/api/activities/7", {
      headers: { Cookie: await cookie() },
    });
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.polyline).toBe("poly");
  });

  it("404s an unknown activity", async () => {
    const res = await SELF.fetch("http://example.com/api/activities/999", {
      headers: { Cookie: await cookie() },
    });
    expect(res.status).toBe(404);
  });
});

describe("/live", () => {
  it("401s without a session", async () => {
    const res = await SELF.fetch("http://example.com/live", {
      headers: { Upgrade: "websocket" },
    });
    expect(res.status).toBe(401);
  });

  it("426s a non-upgrade request that carries a session", async () => {
    const res = await SELF.fetch("http://example.com/live", {
      headers: { Cookie: await cookie() },
    });
    expect(res.status).toBe(426);
  });

  it("upgrades with a valid session", async () => {
    const res = await SELF.fetch("http://example.com/live", {
      headers: { Cookie: await cookie(), Upgrade: "websocket" },
    });
    expect(res.status).toBe(101);
    expect(res.webSocket).toBeTruthy();
  });
});
