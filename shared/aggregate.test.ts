import { describe, it, expect } from "vitest";
import type { ActivitySummary } from "./types";
import { activeDays, computeStreak, groupByDay, weeklyBuckets, weeklyLoad, weekComparison, acwr, personalRecords, bestWeekDistance, recordsSetBy, sportMix, totalsBetween } from "./aggregate";

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

describe("groupByDay", () => {
  it("chunks consecutive same-day rows without re-sorting", () => {
    const rows = [
      a("2026-09-06", { id: 1 }),
      a("2026-09-06", { id: 2 }),
      a("2026-09-04", { id: 3 }),
    ];
    expect(groupByDay(rows)).toEqual([
      { date: "2026-09-06", rows: [rows[0], rows[1]] },
      { date: "2026-09-04", rows: [rows[2]] },
    ]);
  });

  it("returns an empty array for no activities", () => {
    expect(groupByDay([])).toEqual([]);
  });

  it("re-opens a new group if the same day appears non-consecutively", () => {
    const rows = [
      a("2026-09-06", { id: 1 }),
      a("2026-09-05", { id: 2 }),
      a("2026-09-06", { id: 3 }),
    ];
    expect(groupByDay(rows)).toEqual([
      { date: "2026-09-06", rows: [rows[0]] },
      { date: "2026-09-05", rows: [rows[1]] },
      { date: "2026-09-06", rows: [rows[2]] },
    ]);
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

describe("weeklyLoad", () => {
  it("compares the current week against the average of prior weeks with data", () => {
    const rows = [
      a("2026-09-06", { distance: 4000, moving_time: 1200 }), // current week (starts 08-31)
      a("2026-08-25", { distance: 1000, moving_time: 300 }), // week starting 08-24
      a("2026-08-18", { distance: 3000, moving_time: 900 }), // week starting 08-17
    ];
    const load = weeklyLoad(rows, "2026-09-06", 2);
    expect(load.current).toEqual({ distance: 4000, movingTime: 1200 });
    expect(load.average).toEqual({ distance: 2000, movingTime: 600 });
    expect(load.distancePct).toBe(200);
    expect(load.timePct).toBe(200);
  });

  it("averages only over weeks that actually have data", () => {
    const rows = [
      a("2026-09-06", { distance: 1000, moving_time: 300 }),
      a("2026-08-25", { distance: 2000, moving_time: 600 }),
    ];
    const load = weeklyLoad(rows, "2026-09-06", 2);
    expect(load.average).toEqual({ distance: 2000, movingTime: 600 });
    expect(load.distancePct).toBe(50);
  });

  it("reports no average when there is no prior history", () => {
    const rows = [a("2026-09-06", { distance: 1000, moving_time: 300 })];
    const load = weeklyLoad(rows, "2026-09-06", 2);
    expect(load.average).toBeNull();
    expect(load.distancePct).toBeNull();
    expect(load.timePct).toBeNull();
  });
});

describe("weekComparison", () => {
  it("totals the current calendar week and the one before it", () => {
    // 2026-09-06 is a Sunday; its week starts Monday 2026-08-31.
    const rows = [
      a("2026-09-06", { distance: 2000 }), // current week (Mon 08-31 … Sun 09-06)
      a("2026-08-27", { distance: 1000 }), // week starting Mon 08-24
      a("2026-08-25", { distance: 500 }),  // same week as the 1000, totals to 1500
    ];
    const c = weekComparison(rows, "2026-09-06");
    expect(c.week.distance).toBe(2000);
    expect(c.prevWeek.distance).toBe(1500);
    expect(c.distanceDeltaPct).toBeCloseTo(133.33, 0);
  });

  it("returns a null delta when the previous week had no distance", () => {
    const rows = [a("2026-09-06", { distance: 2000 })];
    const c = weekComparison(rows, "2026-09-06");
    expect(c.distanceDeltaPct).toBeNull();
    expect(c.isBestWeek).toBe(false);
  });

  it("flags a best week only when it beats every earlier week", () => {
    const rows = [
      a("2026-09-06", { distance: 5000 }), // current week
      a("2026-08-25", { distance: 4000 }), // prior best
    ];
    const c = weekComparison(rows, "2026-09-06");
    expect(c.isBestWeek).toBe(true);

    const short = weekComparison([a("2026-09-06", { distance: 3000 }), a("2026-08-25", { distance: 4000 })], "2026-09-06");
    expect(short.isBestWeek).toBe(false);
  });
});

// Builds `days` rows of one activity per day ending at `end`, each of the
// given moving time — the building block for acute:chronic scenarios.
function dailyRows(end: string, days: number, movingTime: number): ActivitySummary[] {
  const rows: ActivitySummary[] = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(`${end}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - i);
    rows.push(a(date.toISOString().slice(0, 10), { moving_time: movingTime, distance: 5000 }));
  }
  return rows;
}

describe("acwr", () => {
  it("is 1.0 when the last 7 days match the trailing 28-day average", () => {
    // One run a day for the whole 28-day window → daily means are equal.
    const load = acwr(dailyRows("2026-09-06", 28, 3600), "2026-09-06");
    expect(load.ratio).toBeCloseTo(1.0, 5);
    expect(load.band).toBe("steady");
  });

  it("spikes when the last week is heavy against a lighter baseline", () => {
    // Two runs a day for 7 days, one a day for the 21 before that.
    const rows = [...dailyRows("2026-09-06", 7, 7200), ...dailyRows("2026-08-30", 21, 3600)];
    const load = acwr(rows, "2026-09-06");
    // acute mean 7200, chronic mean (7·7200 + 21·3600)/28 = 4500 → 1.6
    expect(load.ratio).toBeCloseTo(1.6, 1);
    expect(load.band).toBe("spiking");
  });

  it("detrains when the last week is quiet against a heavier baseline", () => {
    const rows = [...dailyRows("2026-09-06", 1, 3600), ...dailyRows("2026-08-30", 21, 3600)];
    const load = acwr(rows, "2026-09-06");
    // acute mean 3600/7 ≈ 514, chronic mean 22·3600/28 ≈ 2829 → ≈ 0.18
    expect(load.ratio).toBeLessThan(0.8);
    expect(load.band).toBe("detraining");
  });

  it("has no ratio until there is chronic history", () => {
    const load = acwr([], "2026-09-06");
    expect(load.ratio).toBeNull();
    expect(load.band).toBeNull();
  });

  it("has no ratio with too little baseline training (fewer than 7 days in 28)", () => {
    const load = acwr(dailyRows("2026-09-06", 3, 3600), "2026-09-06");
    expect(load.ratio).toBeNull();
    expect(load.band).toBeNull();
  });
});

describe("personalRecords", () => {
  it("finds the longest run, fastest run pace, and most climbing", () => {
    const rows = [
      a("2026-09-01", { sport_type: "Run", distance: 5000, moving_time: 1800, total_elevation_gain: 50 }),
      a("2026-09-02", { sport_type: "Run", distance: 10000, moving_time: 3300, total_elevation_gain: 120, name: "Long Run" }),
      a("2026-09-03", { sport_type: "Ride", distance: 30000, moving_time: 5400, total_elevation_gain: 400, name: "Climb Day" }),
    ];
    const pr = personalRecords(rows);
    expect(pr.longestRun?.name).toBe("Long Run");
    expect(pr.longestRun?.value).toBe(10000);
    expect(pr.mostClimb?.name).toBe("Climb Day");
    expect(pr.mostClimb?.value).toBe(400);
    // fastest run: 5km in 1800s → 360 s/km beats 10km in 3300s → 330 s/km
    expect(pr.fastestRun?.name).toBe("Long Run");
    expect(pr.fastestRun?.value).toBe(330);
  });

  it("ignores sub-kilometre efforts for the fastest-run record", () => {
    const rows = [
      a("2026-09-01", { sport_type: "Run", distance: 5000, moving_time: 1800 }),
      a("2026-09-02", { sport_type: "Run", distance: 400, moving_time: 60 }), // 150 s/km — would "win"
    ];
    expect(personalRecords(rows).fastestRun?.value).toBe(360);
  });

  it("returns nulls for an empty history", () => {
    expect(personalRecords([])).toEqual({ longestRun: null, fastestRun: null, mostClimb: null });
  });
});

describe("bestWeekDistance", () => {
  it("finds the highest Monday-start week", () => {
    const rows = [
      a("2026-09-06", { distance: 1000 }), // week of 08-31
      a("2026-08-27", { distance: 2000 }), // week of 08-24
      a("2026-08-25", { distance: 3000 }), // same week of 08-24 → 5000
    ];
    const best = bestWeekDistance(rows);
    expect(best?.weekStart).toBe("2026-08-24");
    expect(best?.distance).toBe(5000);
  });

  it("returns null with no rows", () => {
    expect(bestWeekDistance([])).toBeNull();
  });
});

describe("recordsSetBy", () => {
  it("reports only the records the given activity improves", () => {
    const history = [
      a("2026-09-01", { id: 1, sport_type: "Run", distance: 5000, moving_time: 1800, total_elevation_gain: 50 }),
    ];
    const pr = a("2026-09-02", { id: 2, sport_type: "Run", distance: 10000, moving_time: 3300, total_elevation_gain: 120 });
    expect(recordsSetBy([...history, pr], pr)).toEqual(["Longest run", "Fastest run", "Most climbing"]);

    const worse = a("2026-09-02", { id: 3, sport_type: "Run", distance: 3000, moving_time: 1200 });
    expect(recordsSetBy([...history, worse], worse)).toEqual([]);
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
