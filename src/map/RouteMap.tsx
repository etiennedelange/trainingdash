import { useEffect, useRef } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { decodePolyline, bounds } from "./polyline";

// Tile source confirmed live 2026-09-06 (200, dark background style, no account
// needed). MapLibre ships no tiles of its own.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const coords = decodePolyline(polyline);
    if (coords.length === 0) return;

    const map = new MapLibreMap({
      container: el,
      style: STYLE_URL,
      bounds: bounds(coords),
      fitBoundsOptions: { padding: 32 },
      attributionControl: { compact: true },
    });

    map.on("load", () => {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: coords },
        },
      });
      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#2dd4bf", "line-width": 3 },
      });
    });

    return () => map.remove();
  }, [polyline]);

  return <div ref={containerRef} className="h-[320px] w-full rounded-[var(--radius-card)]" />;
}
