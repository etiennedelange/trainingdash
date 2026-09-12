import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Map as MapLibreMap, setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { parsePolyline, bounds, kmMarkers } from "./polyline";
import { cssVar, useTheme } from "@/hooks/useTheme";

// Both styles confirmed live 2026-09-06 (200, no account needed). MapLibre
// ships no tiles of its own.
const STYLE_URL = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
} as const;

// Keep a short or jittery route from fitting to street level; the map should
// frame the effort, not a single GPS blip.
const FIT_OPTIONS = { padding: 32, maxZoom: 15 };

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

/**
 * Draw the route, its km ticks, and its endpoints from the live design
 * tokens. Called on every `style.load`, so a theme switch (which swaps the
 * basemap via `setStyle`) re-adds the overlays in that theme's colors.
 */
function addRouteLayers(map: MapLibreMap, coords: [number, number][]) {
  if (map.getSource("route") || coords.length < 2) return;

  const accent = cssVar("--color-accent");
  const ground = cssVar("--color-ground");
  const card = cssVar("--color-card");
  const lineLayout = { "line-join": "round", "line-cap": "round" } as const;

  map.addSource("route", {
    type: "geojson",
    data: {
      type: "Feature",
      properties: {},
      geometry: { type: "LineString", coordinates: coords },
    },
  });
  // A ground-colored casing keeps the accent line legible on both basemaps —
  // the dark one and the light Positron one.
  map.addLayer({
    id: "route-casing",
    type: "line",
    source: "route",
    layout: lineLayout,
    paint: { "line-color": ground, "line-width": 6, "line-opacity": 0.5 },
  });
  map.addLayer({
    id: "route",
    type: "line",
    source: "route",
    layout: lineLayout,
    paint: { "line-color": accent, "line-width": 3 },
  });

  const ticks = kmMarkers(coords);
  if (ticks.length > 0) {
    map.addSource("km", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: ticks.map(([lng, lat]) => ({
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [lng, lat] },
        })),
      },
    });
    map.addLayer({
      id: "km",
      type: "circle",
      source: "km",
      paint: {
        "circle-radius": 3,
        "circle-color": accent,
        "circle-stroke-color": ground,
        "circle-stroke-width": 1,
      },
    });
  }

  const start = coords[0]!;
  const finish = coords[coords.length - 1]!;
  map.addSource("endpoints", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { kind: "start" },
          geometry: { type: "Point", coordinates: start },
        },
        {
          type: "Feature",
          properties: { kind: "finish" },
          geometry: { type: "Point", coordinates: finish },
        },
      ],
    },
  });
  // Hollow finish ring reads as "the end" against the solid start dot without
  // introducing a second color — the One Signal Rule holds on the canvas.
  map.addLayer({
    id: "endpoint-finish",
    type: "circle",
    source: "endpoints",
    filter: ["==", ["get", "kind"], "finish"],
    paint: {
      "circle-radius": 6,
      "circle-color": ground,
      "circle-stroke-color": accent,
      "circle-stroke-width": 3,
    },
  });
  map.addLayer({
    id: "endpoint-start",
    type: "circle",
    source: "endpoints",
    filter: ["==", ["get", "kind"], "start"],
    paint: {
      "circle-radius": 6,
      "circle-color": accent,
      "circle-stroke-color": card,
      "circle-stroke-width": 2,
    },
  });
}

function ControlButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-control)] border border-line bg-card text-muted transition-colors hover:bg-raised hover:text-text sm:h-9 sm:w-9"
    >
      {children}
    </button>
  );
}

export function RouteMap({
  polyline,
  label,
  emptyMessage = "No route recorded for this activity.",
}: {
  polyline?: string | null;
  label: string;
  emptyMessage?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const coordsRef = useRef<[number, number][]>([]);
  const themeRef = useRef<"dark" | "light">("dark");
  const themeMountedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [theme] = useTheme();

  const coords = useMemo(() => parsePolyline(polyline ?? ""), [polyline]);
  const hasRoute = coords.length >= 2;
  coordsRef.current = coords;
  themeRef.current = theme;

  useEffect(() => {
    if (!hasRoute) return;
    const el = containerRef.current;
    if (!el) return;

    setFailed(false);
    setLoaded(false);

    // MapLibre's constructor throws synchronously when the environment lacks
    // WebGL2 (disabled by browser policy, older hardware, some sandboxes).
    // Uncaught, that exception propagates out of this effect and up through
    // React into the route's error boundary, blanking the whole activity
    // page instead of just this card — so it's caught here and degraded.
    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
        container: el,
        style: STYLE_URL[themeRef.current],
        bounds: bounds(coords),
        fitBoundsOptions: FIT_OPTIONS,
        attributionControl: { compact: true },
      });
    } catch (err) {
      console.error("map init failed", err);
      setFailed(true);
      return;
    }

    mapRef.current = map;
    map.touchZoomRotate.disableRotation();
    map.dragRotate.disable();
    map.getCanvas().setAttribute("aria-label", label);

    const onStyleLoad = () => {
      addRouteLayers(map, coordsRef.current);
      setLoaded(true);
    };
    map.on("style.load", onStyleLoad);
    map.on("error", (e) => console.error("map error", e.error));

    // The card grows and shrinks with the flex column around it; MapLibre only
    // listens for window resizes, so keep its canvas in step with its box.
    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(el);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapRef.current = null;
    };
    // Theme is read through themeRef so a toggle swaps the style in place
    // (below) instead of tearing the map down and losing the viewpoint.
  }, [coords, hasRoute, label]);

  useEffect(() => {
    mapRef.current?.getCanvas().setAttribute("aria-label", label);
  }, [label, loaded]);

  useEffect(() => {
    // First run is the initial style set in the constructor; skip it.
    if (!themeMountedRef.current) {
      themeMountedRef.current = true;
      return;
    }
    // Swapping the style keeps the camera; `style.load` re-adds the overlays
    // in the new theme's token colors.
    mapRef.current?.setStyle(STYLE_URL[theme], { diff: false });
  }, [theme]);

  useEffect(() => {
    const onFullscreenChange = () => mapRef.current?.resize();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function resetView() {
    mapRef.current?.fitBounds(bounds(coordsRef.current), FIT_OPTIONS);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void wrapRef.current?.requestFullscreen?.();
    }
  }

  return (
    <div
      ref={wrapRef}
      className="route-map relative flex min-h-[320px] w-full flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-card shadow-[var(--shadow-surface)]"
    >
      {!hasRoute ? (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center p-4 text-sm text-muted">
          {emptyMessage}
        </div>
      ) : failed ? (
        <div className="flex min-h-0 w-full flex-1 items-center justify-center p-4 text-sm text-muted">
          Map unavailable in this browser.
        </div>
      ) : (
        <>
          <div ref={containerRef} className="min-h-0 w-full flex-1" />
          {!loaded ? (
            <div className="absolute inset-0 flex items-center justify-center bg-card">
              <div className="animate-skeleton-pulse h-1.5 w-24 rounded-full bg-raised" />
            </div>
          ) : (
            <div className="absolute top-3 right-3 flex flex-col gap-1.5">
              <ControlButton label="Zoom in" onClick={() => mapRef.current?.zoomIn()}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M8 3.5v9M3.5 8h9" />
                </svg>
              </ControlButton>
              <ControlButton label="Zoom out" onClick={() => mapRef.current?.zoomOut()}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                  <path d="M3.5 8h9" />
                </svg>
              </ControlButton>
              <ControlButton label="Fit route" onClick={resetView}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2.5 6V3.5a1 1 0 0 1 1-1H6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
                  <circle cx="8" cy="8" r="1.4" />
                </svg>
              </ControlButton>
              <ControlButton label="Toggle fullscreen" onClick={toggleFullscreen}>
                <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2.5H3.5a1 1 0 0 0-1 1V6M10 2.5h2.5a1 1 0 0 1 1 1V6M13.5 10v2.5a1 1 0 0 1-1 1H10M6 13.5H3.5a1 1 0 0 1-1-1V10" />
                </svg>
              </ControlButton>
            </div>
          )}
        </>
      )}
    </div>
  );
}
