import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      // Without this, vite-plugin-pwa only registers a service worker in
      // production builds — Chrome then has no SW to base installability on,
      // so the omnibox install icon never appears while running `pnpm dev`.
      devOptions: {
        enabled: true,
        type: "module",
      },
      manifest: {
        name: "Trainingdash",
        short_name: "Trainingdash",
        description: "A gamified dashboard for your Strava activities",
        theme_color: "#0b0e13",
        background_color: "#0b0f14",
        display: "standalone",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // API responses are never precached — the dashboard must not show a
        // stale history that looks current. The shell is offline; the data is not.
        //
        // These four must match the Worker's own routes exactly. /webhook is
        // matched as a prefix because the live route is /webhook/:token, not
        // bare /webhook (see "What Plan 1 discovered").
        navigateFallbackDenylist: [/^\/api\//, /^\/auth\//, /^\/webhook/, /^\/live$/],
      },
    }),
    cloudflare(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "#shared": path.resolve(import.meta.dirname, "./shared"),
    },
  },
  server: {
    // Lets a cloudflared quick tunnel (a fresh random *.trycloudflare.com
    // host every run) reach this dev server despite Vite's Host-header check.
    allowedHosts: [".trycloudflare.com"],
  },
  build: { outDir: "dist" },
});
