import { describe, it, expect } from "vitest";
import type { ActivitySummary } from "./types";
import { activeDays, computeStreak, weeklyBuckets, sportMix, totalsBetween } from "./aggregate";

const a = (local_date: string, over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id: Math.random(),
  name: "Run",
  sport_type: "Run",
  start_date: `${local_date}T10:00:00Z`,
  local_date,
  elapsed_time: 1800,
  moving_time: 1800,
  distance: 5000,
  total_elevation_gain: 10,
  average_speed: 2.78,
  average_heartrate: 150,
  suffer_score: 20,
  updated_at: 1,
  ...over,
});

describe("activeDays", () => {
  it("dedupes and sorts", () => {
    expect(activeDays([a("2026-09-03"), a("2026-09-01"), a("2026-09-03")]))
      .toEqual(["2026-09-01", "2026-09-03"]);
  });
});

describe("computeStreak", () => {
  it("counts consecutive days ending today", () => {
    const rows = [a("2026-09-06"), a("2026-09-05"), a("2026-09-04")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(3);
  });

  it("keeps the streak alive when today has no activity yet but yesterday did", () => {
    const rows = [a("2026-09-05"), a("2026-09-04")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(2);
  });

  it("breaks the streak after a missed day", () => {
    const rows = [a("2026-09-04"), a("2026-09-03")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(0);
  });

  it("counts two activities on one day as one day", () => {
    const rows = [a("2026-09-06"), a("2026-09-06"), a("2026-09-05")];
    expect(computeStreak(rows, "2026-09-06").current).toBe(2);
  });

  it("finds the longest historical streak even when the current one is shorter", () => {
    const rows = [
      a("2026-09-06"),
      a("2026-08-01"), a("2026-08-02"), a("2026-08-03"), a("2026-08-04"),
    ];
    const s = computeStreak(rows, "2026-09-06");
    expect(s.current).toBe(1);
    expect(s.longest).toBe(4);
  });

  it("crosses a month boundary", () => {
    const rows = [a("2026-09-01"), a("2026-08-31"), a("2026-08-30")];
    expect(computeStreak(rows, "2026-09-01").current).toBe(3);
  });

  it("handles an empty history", () => {
    expect(computeStreak([], "2026-09-06")).toEqual({
      current: 0, longest: 0, lastActiveDate: null,
    });
  });
});

describe("weeklyBuckets", () => {
  it("buckets by ISO week starting Monday, newest last", () => {
    // 2026-09-06 is a Sunday; its week starts Monday 2026-08-31.
    const rows = [a("2026-09-06", { distance: 1000 }), a("2026-09-01", { distance: 2000 })];
    const buckets = weeklyBuckets(rows, 2, "2026-09-06");
    expect(buckets).toHaveLength(2);
    expect(buckets[1]?.weekStart).toBe("2026-08-31");
    expect(buckets[1]?.distance).toBe(3000);
  });

  it("emits zero-filled weeks with no activity", () => {
    const buckets = weeklyBuckets([], 3, "2026-09-06");
    expect(buckets).toHaveLength(3);
    expect(buckets.every((b) => b.count === 0 && b.distance === 0)).toBe(true);
  });

  it("ignores activities older than the window", () => {
    const buckets = weeklyBuckets([a("2020-01-01", { distance: 9999 })], 2, "2026-09-06");
    expect(buckets.reduce((n, b) => n + b.distance, 0)).toBe(0);
  });
});

describe("sportMix", () => {
  it("returns percentages that sum to 100 and are ordered by count", () => {
    const rows = [
      a("2026-09-01", { sport_type: "Run" }),
      a("2026-09-02", { sport_type: "Run" }),
      a("2026-09-03", { sport_type: "Ride" }),
      a("2026-09-04", { sport_type: "Walk" }),
    ];
    const mix = sportMix(rows);
    expect(mix[0]?.sport).toBe("Run");
    expect(mix[0]?.pct).toBe(50);
    expect(mix.reduce((n, m) => n + m.pct, 0)).toBe(100);
  });

  it("returns an empty array for no activities", () => {
    expect(sportMix([])).toEqual([]);
  });
});

describe("totalsBetween", () => {
  it("sums inclusively on both ends", () => {
    const rows = [
      a("2026-09-01", { distance: 1000, moving_time: 600, total_elevation_gain: 5 }),
      a("2026-09-05", { distance: 2000, moving_time: 900, total_elevation_gain: 15 }),
      a("2026-09-09", { distance: 4000 }),
    ];
    expect(totalsBetween(rows, "2026-09-01", "2026-09-05")).toEqual({
      count: 2, distance: 3000, movingTime: 1500, elevation: 20,
    });
  });

  it("treats a null elevation as zero", () => {
    const rows = [a("2026-09-01", { total_elevation_gain: null })];
    expect(totalsBetween(rows, "2026-09-01", "2026-09-01").elevation).toBe(0);
  });
});
