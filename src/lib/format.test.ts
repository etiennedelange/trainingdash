import { describe, it, expect } from "vitest";
import { formatDistance, formatDuration, formatPace } from "./format";

describe("formatDistance", () => {
  it("renders kilometres to two decimals", () => {
    expect(formatDistance(6420)).toBe("6.42");
  });
  it("renders zero", () => {
    expect(formatDistance(0)).toBe("0.00");
  });
});

describe("formatDuration", () => {
  it("renders mm:ss under an hour", () => {
    expect(formatDuration(2052)).toBe("34:12");
  });
  it("renders h:mm:ss at or over an hour", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });
  it("pads seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
  });
});

describe("formatPace", () => {
  it("renders minutes per kilometre", () => {
    // 6420 m in 2052 s → 319.6 s/km → 5:20
    expect(formatPace(2052 / 6.42)).toBe("5:20");
  });
  it("returns a dash for a non-finite pace", () => {
    expect(formatPace(Number.POSITIVE_INFINITY)).toBe("—");
    expect(formatPace(Number.NaN)).toBe("—");
  });
});
