import { describe, it, expect } from "vitest";
import {
  decodePolyline,
  bounds,
  haversineKm,
  kmMarkers,
  parsePolyline,
} from "./polyline";

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

describe("haversineKm", () => {
  it("measures one degree of latitude as ~111 km", () => {
    expect(haversineKm([0, 0], [0, 1])).toBeCloseTo(111.19, 1);
  });

  it("is zero for identical points", () => {
    expect(haversineKm([12.34, 56.78], [12.34, 56.78])).toBe(0);
  });
});

describe("kmMarkers", () => {
  it("places one interpolated tick on a route just past 1 km", () => {
    // 0.011° of latitude ≈ 1.22 km, so a single 1 km tick lands part-way.
    const markers = kmMarkers([[0, 0], [0, 0.011]]);
    expect(markers).toHaveLength(1);
    expect(markers[0]?.[1]).toBeCloseTo(0.009, 3);
  });

  it("returns nothing for a degenerate route", () => {
    expect(kmMarkers([[0, 0]])).toEqual([]);
    expect(kmMarkers([[0, 0], [0, 0]])).toEqual([]);
  });
});

describe("parsePolyline", () => {
  it("returns validated coordinates for a good polyline", () => {
    expect(parsePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toHaveLength(3);
  });

  it("returns an empty array for missing or undrawable input", () => {
    expect(parsePolyline("")).toEqual([]);
    // A single decoded point cannot form a line.
    expect(parsePolyline("_p~iF~ps|U")).toEqual([]);
  });
});
