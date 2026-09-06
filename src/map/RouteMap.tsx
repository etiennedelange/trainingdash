import { useEffect, useRef, useState } from "react";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { decodePolyline, bounds } from "./polyline";
import { cssVar, useTheme } from "@/hooks/useTheme";

// Both styles confirmed live 2026-09-06 (200, no account needed). MapLibre
// ships no tiles of its own.
const STYLE_URL = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;

// maplibre-gl computes its Web Worker's filename dynamically at runtime
// (`moduleUrl.endsWith("-dev.mjs") ? ... : "maplibre-gl-worker.mjs"`), which
// Vite can't statically analyze into a bundled asset — the file is never
// emitted to dist/, so the worker request 404s. Our own SPA catch-all route
// then serves index.html for that 404 (a non-JS MIME type), the worker never
// starts, and the map never renders a single tile (though the style JSON
// still loads on the main thread, so e.g. attribution shows regardless).
// public/maplibre-gl-worker.mjs is a manual copy of maplibre-gl's own
// dist/maplibre-gl-worker.mjs, which itself has a relative import —
// `from "./maplibre-gl-shared.mjs"` — so that file is copied alongside it
// in public/ too. Re-copy both if maplibre-gl is upgraded.
setWorkerUrl("/maplibre-gl-worker.mjs");

export function RouteMap({ polyline }: { polyline: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);
  const [theme] = useTheme();

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
        style: STYLE_URL[theme],
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
        paint: { "line-color": cssVar("--color-accent"), "line-width": 3 },
      });
    });

    return () => map.remove();
    // theme rebuilds the map on toggle: MapLibre has no "swap basemap
    // in place" primitive worth the complexity for an occasional flip.
  }, [polyline, theme]);

  if (failed) {
    return (
      <div className="flex h-[320px] w-full items-center justify-center rounded-[var(--radius-card)] bg-card text-sm text-muted">
        Map unavailable in this browser.
      </div>
    );
  }

  return <div ref={containerRef} className="h-[320px] w-full rounded-[var(--radius-card)]" />;
}
