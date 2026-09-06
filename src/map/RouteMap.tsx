import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { decodePolyline, bounds } from "./polyline";

// Tile source confirmed live 2026-09-06 (200, dark background style, no account
// needed). MapLibre ships no tiles of its own.
const STYLE_URL = "https://tiles.openfreemap.org/styles/dark";

export function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const coords = decodePolyline(polyline);
    if (coords.length === 0) return;

    // MapLibre's constructor throws synchronously when the environment lacks
    // WebGL2 (disabled by browser policy, older hardware, some sandboxes).
    // Uncaught, that exception propagates out of this effect and up through
    // React into the route's error boundary, blanking the whole activity
    // page instead of just this card — so it's caught here and degraded.
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: el,
        style: STYLE_URL,
        bounds: bounds(coords),
        fitBoundsOptions: { padding: 32 },
        attributionControl: { compact: true },
      });
    } catch (err) {
      console.error("map init failed", err);
      setFailed(true);
      return;
    }

    map.on("error", (e) => console.error("map error", e.error));

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

  if (failed) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-[var(--radius-card)] bg-card text-sm text-muted">
        Map unavailable in this browser.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[320px] w-full rounded-[var(--radius-card)]" />;
}
