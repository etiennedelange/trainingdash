import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { athleteAllowed } from "./oauth";
import { saveAthlete } from "../db/athlete";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM athlete").run();
});

describe("athleteAllowed", () => {
  it("allows the configured id when ALLOWED_ATHLETE_ID is set", async () => {
    expect(await athleteAllowed({ ...env, ALLOWED_ATHLETE_ID: "42" }, 42)).toBe(true);
  });

  it("refuses every other id when ALLOWED_ATHLETE_ID is set, even if nobody has connected yet", async () => {
    expect(await athleteAllowed({ ...env, ALLOWED_ATHLETE_ID: "42" }, 7)).toBe(false);
  });

  it("falls back to first-claim when ALLOWED_ATHLETE_ID is unset", async () => {
    expect(await athleteAllowed({ ...env, ALLOWED_ATHLETE_ID: "" }, 7)).toBe(true);
    await saveAthlete(env.DB, {
      id: 7, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    expect(await athleteAllowed({ ...env, ALLOWED_ATHLETE_ID: "" }, 7)).toBe(true);
    expect(await athleteAllowed({ ...env, ALLOWED_ATHLETE_ID: "" }, 8)).toBe(false);
  });
});
