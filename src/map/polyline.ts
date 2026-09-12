/**
 * Google encoded-polyline decoder. Strava's `summary_polyline` uses precision 5.
 * Returns [lng, lat] pairs — GeoJSON order, which is what MapLibre expects and
 * the reverse of how the algorithm reads them.
 */
export function decodePolyline(encoded: string, precision = 5): [number, number][] {
  const factor = 10 ** precision;
  const coords: [number, number][] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coords.push([lng / factor, lat / factor]);
  }

  return coords;
}

export function bounds(
  coords: [number, number][],
): [[number, number], [number, number]] {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [[minLng, minLat], [maxLng, maxLat]];
}

const EARTH_RADIUS_KM = 6371;

function toRadians(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance between two [lng, lat] points, in kilometers. */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const dLat = toRadians(b[1] - a[1]);
  const dLng = toRadians(b[0] - a[0]);
  const lat1 = toRadians(a[1]);
  const lat2 = toRadians(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Points at every `intervalKm` along the route, interpolated within the
 * segment they fall on — used for the on-map kilometer ticks. Excludes the
 * endpoints (the start/finish markers own those).
 */
export function kmMarkers(
  coords: [number, number][],
  intervalKm = 1,
): [number, number][] {
  if (coords.length < 2 || intervalKm <= 0) return [];
  const markers: [number, number][] = [];
  let travelled = 0;
  let next = intervalKm;

  for (let i = 1; i < coords.length; i++) {
    const a = coords[i - 1]!;
    const b = coords[i]!;
    const segment = haversineKm(a, b);
    if (segment <= 0) continue;
    while (next <= travelled + segment) {
      const t = (next - travelled) / segment;
      markers.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      next += intervalKm;
    }
    travelled += segment;
  }

  return markers;
}

/**
 * Decode a polyline into validated coordinates, or an empty array when it is
 * missing/malformed. Strava data is normally trustworthy, but a bad value
 * would otherwise reach MapLibre and leave a silent blank canvas.
 */
export function parsePolyline(polyline: string): [number, number][] {
  if (!polyline) return [];
  let coords: [number, number][];
  try {
    coords = decodePolyline(polyline);
  } catch {
    return [];
  }
  if (coords.length < 2) return [];
  const valid = coords.every(
    ([lng, lat]) =>
      Number.isFinite(lng) &&
      Number.isFinite(lat) &&
      Math.abs(lng) <= 180 &&
      Math.abs(lat) <= 90,
  );
  return valid ? coords : [];
}
