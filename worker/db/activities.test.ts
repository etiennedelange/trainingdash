import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { upsertActivity, deleteActivity, getActivity, listActivities } from "./activities";
import type { ActivityRow } from "#shared/types";

const row = (over: Partial<ActivityRow> = {}): ActivityRow => ({
  id: 1, name: "Evening Run", sport_type: "Run",
  start_date: "2026-09-05T18:41:00Z", local_date: "2026-09-05",
  elapsed_time: 2052, moving_time: 2052, distance: 6420,
  total_elevation_gain: 48, average_speed: 3.13, average_heartrate: 152,
  suffer_score: 40, polyline: "abc", raw: "{}", updated_at: 1,
  ...over,
});

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM activities").run();
});

describe("activities", () => {
  it("inserts and reads back a row", async () => {
    await upsertActivity(env.DB, row());
    expect((await getActivity(env.DB, 1))?.name).toBe("Evening Run");
  });

  it("updates on conflict rather than duplicating", async () => {
    await upsertActivity(env.DB, row());
    await upsertActivity(env.DB, row({ name: "Renamed", updated_at: 2 }));
    const all = await listActivities(env.DB);
    expect(all).toHaveLength(1);
    expect(all[0]?.name).toBe("Renamed");
  });

  it("deletes", async () => {
    await upsertActivity(env.DB, row());
    await deleteActivity(env.DB, 1);
    expect(await getActivity(env.DB, 1)).toBeNull();
  });

  it("lists newest first", async () => {
    await upsertActivity(env.DB, row({ id: 1, local_date: "2026-09-01" }));
    await upsertActivity(env.DB, row({ id: 2, local_date: "2026-09-05" }));
    expect((await listActivities(env.DB)).map((a) => a.id)).toEqual([2, 1]);
  });
});
