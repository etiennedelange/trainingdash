import { describe, it, expect } from "vitest";
import { buildDigest } from "./digest";
import type { ActivitySummary } from "#shared/types";

const a = (local_date: string, over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id: 1, name: "Evening Run", sport_type: "Run",
  start_date: `${local_date}T18:41:00Z`, local_date,
  elapsed_time: 2052, moving_time: 2052, distance: 6420,
  total_elevation_gain: 48, average_speed: 3.13, average_heartrate: 152,
  suffer_score: 40, updated_at: 1,
  ...over,
});

const rows = [
  a("2026-09-06", { id: 1 }),
  a("2026-09-05", { id: 2, sport_type: "Ride", distance: 24000 }),
  a("2026-09-03", { id: 3, sport_type: "WeightTraining", distance: 0 }),
];

describe("buildDigest", () => {
  it("is byte-identical across repeated calls with the same input", () => {
    expect(buildDigest(rows, "2026-09-06")).toBe(buildDigest(rows, "2026-09-06"));
  });

  it("is byte-identical regardless of input row order", () => {
    const shuffled = [rows[2]!, rows[0]!, rows[1]!];
    expect(buildDigest(shuffled, "2026-09-06")).toBe(buildDigest(rows, "2026-09-06"));
  });

  it("contains no timestamp or random token that would break the cache", () => {
    const digest = buildDigest(rows, "2026-09-06");
    // A unix timestamp near now would defeat prefix caching entirely.
    expect(digest).not.toMatch(/\b17\d{8,}\b/);
    expect(digest).not.toMatch(/\b\d{13}\b/);
  });

  it("includes the streak, weekly totals and sport mix", () => {
    const digest = buildDigest(rows, "2026-09-06");
    expect(digest).toContain("Streak");
    expect(digest).toContain("Run");
    expect(digest).toContain("Ride");
  });

  it("only covers the last 30 days", () => {
    const withOld = [...rows, a("2020-01-01", { id: 9, name: "Ancient Run" })];
    expect(buildDigest(withOld, "2026-09-06")).not.toContain("Ancient Run");
  });

  it("produces a usable digest from an empty history", () => {
    const digest = buildDigest([], "2026-09-06");
    expect(digest).toContain("No activities");
    expect(digest).toBe(buildDigest([], "2026-09-06"));
  });

  it("includes activities in weekly buckets even if outside 30-day window", () => {
    // For today="2026-09-06", the 30-day window starts at 2026-08-08
    // But the 5-week window extends back to 2026-08-03
    // An activity on 2026-08-07 should appear in weekly totals but not in Activities/Totals sections
    const withOldWeekly = [
      ...rows,
      a("2026-08-07", { id: 10, name: "Old Weekly Activity", distance: 10000 }),
    ];
    const digest = buildDigest(withOldWeekly, "2026-09-06");
    // Should not appear in Activities section (outside 30 days)
    expect(digest).not.toContain("Old Weekly Activity");
    // But should appear in Weekly distance section (within 5-week window)
    expect(digest).toContain("2026-08-03");
  });
});
