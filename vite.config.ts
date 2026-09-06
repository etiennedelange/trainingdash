import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import path from "node:path";

export default defineConfig({
  plugins: [react(), tailwindcss(), cloudflare()],
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
