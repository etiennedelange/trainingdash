import { defineConfig } from "vitest/config";
import {
  cloudflarePool,
  cloudflareTest,
  readD1Migrations,
} from "@cloudflare/vitest-pool-workers";
import react from "@vitejs/plugin-react";
import { playwright } from "@vitest/browser-playwright";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

const cfConfig = {
  wrangler: { configPath: "./wrangler.jsonc" },
  miniflare: {
    compatibilityFlags: ["nodejs_compat"],
    bindings: { TEST_MIGRATIONS: migrations },
  },
};

const alias = {
  "@": path.resolve(import.meta.dirname, "./src"),
  "#shared": path.resolve(import.meta.dirname, "./shared"),
};

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [cloudflareTest(cfConfig)],
        resolve: { alias },
        test: {
          name: "worker",
          include: ["worker/**/*.test.ts", "shared/**/*.test.ts"],
          setupFiles: ["./worker/test/apply-migrations.ts"],
          pool: cloudflarePool(cfConfig),
        },
      },
      {
        // registerType/manifest values here are irrelevant to tests — this
        // plugin instance exists only so `virtual:pwa-register/react`
        // resolves for components that import it, matching vite.config.ts.
        plugins: [react(), VitePWA({ registerType: "prompt" })],
        resolve: { alias },
        test: {
          name: "browser",
          include: ["src/**/*.test.{ts,tsx}"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
