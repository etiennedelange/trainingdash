import { defineConfig } from "vitest/config";
import { cloudflarePool, cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import path from "node:path";

const migrations = await readD1Migrations(path.join(import.meta.dirname, "migrations"));

const cfConfig = {
  wrangler: { configPath: "./wrangler.jsonc" },
  miniflare: {
    compatibilityFlags: ["nodejs_compat"],
    bindings: { TEST_MIGRATIONS: migrations },
  },
};

export default defineConfig({
  plugins: [cloudflareTest(cfConfig)],
  test: {
    setupFiles: ["./worker/test/apply-migrations.ts"],
    pool: cloudflarePool(cfConfig),
  },
});
