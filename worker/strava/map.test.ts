import { describe, it, expect } from "vitest";
import { toRow } from "./map";
import type { StravaActivity } from "./types";

const activity: StravaActivity = {
  id: 1360128428,
  name: "Evening Run",
  sport_type: "Run",
  start_date: "2026-09-05T16:41:00Z",
  start_date_local: "2026-09-05T18:41:00Z",
  elapsed_time: 2052,
  moving_time: 2052,
  distance: 6420.5,
  total_elevation_gain: 48,
  average_speed: 3.13,
  average_heartrate: 152,
  suffer_score: 40,
  map: { summary_polyline: "abc123" },
};

describe("toRow", () => {
  it("takes local_date from start_date_local, not start_date", () => {
    // 16:41Z is the 5th in UTC and the 5th locally here, but the rule must
    // read the local field — an evening run in UTC+13 would differ.
    expect(toRow(activity).local_date).toBe("2026-09-05");
    expect(toRow({ ...activity, start_date_local: "2026-09-06T01:10:00Z" }).local_date)
      .toBe("2026-09-06");
  });

  it("flattens the summary polyline", () => {
    expect(toRow(activity).polyline).toBe("abc123");
    expect(toRow({ ...activity, map: null }).polyline).toBeNull();
    expect(toRow({ ...activity, map: {} }).polyline).toBeNull();
  });

  it("normalises absent optional numbers to null", () => {
    const r = toRow({ ...activity, average_heartrate: undefined, suffer_score: undefined });
    expect(r.average_heartrate).toBeNull();
    expect(r.suffer_score).toBeNull();
  });

  it("keeps the full payload in raw", () => {
    expect(JSON.parse(toRow(activity).raw).id).toBe(1360128428);
  });
});
