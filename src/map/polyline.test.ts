import { describe, it, expect } from "vitest";
import { decodePolyline, bounds } from "./polyline";

describe("decodePolyline", () => {
  it("decodes the reference string from Google's algorithm docs", () => {
    // _p~iF~ps|U_ulLnnqC_mqNvxq`@ → (38.5,-120.2) (40.7,-120.95) (43.252,-126.453)
    const coords = decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@");
    expect(coords).toHaveLength(3);
    // GeoJSON order: [lng, lat]
    expect(coords[0]?.[1]).toBeCloseTo(38.5, 5);
    expect(coords[0]?.[0]).toBeCloseTo(-120.2, 5);
    expect(coords[2]?.[1]).toBeCloseTo(43.252, 5);
    expect(coords[2]?.[0]).toBeCloseTo(-126.453, 5);
  });

  it("returns an empty array for an empty string", () => {
    expect(decodePolyline("")).toEqual([]);
  });
});

describe("bounds", () => {
  it("returns south-west then north-east corners", () => {
    expect(bounds([[-120.2, 38.5], [-126.453, 43.252]])).toEqual([
      [-126.453, 38.5],
      [-120.2, 43.252],
    ]);
  });
});
