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
    // Fixed dummy secrets so the suite runs on a fresh clone with no
    // .dev.vars, and never picks up real credentials when one exists.
    bindings: {
      TEST_MIGRATIONS: migrations,
      STRAVA_CLIENT_ID: "test-client-id",
      STRAVA_CLIENT_SECRET: "test-client-secret",
      STRAVA_VERIFY_TOKEN: "test-verify-token",
      SESSION_SECRET: "test-session-secret-0123456789abcdef",
      ANTHROPIC_API_KEY: "sk-ant-test",
      VAPID_PUBLIC_KEY: "test-vapid-public-key",
      // Tests exercise the unlocked, first-athlete-claims path; the real
      // deployment's lock in wrangler.jsonc must not leak in.
      ALLOWED_ATHLETE_ID: "",
    },
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
