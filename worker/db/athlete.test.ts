import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getAthlete, saveAthlete, setConnected, getCoachKeyEnc, setCoachKeyEnc } from "./athlete";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM athlete").run();
});

describe("athlete", () => {
  it("returns null when nobody has connected", async () => {
    expect(await getAthlete(env.DB)).toBeNull();
  });

  it("saves and reads back, mapping connected to a boolean", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    const a = await getAthlete(env.DB);
    expect(a?.id).toBe(42);
    expect(a?.connected).toBe(true);
  });

  it("marks disconnected", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    await setConnected(env.DB, 42, false);
    expect((await getAthlete(env.DB))?.connected).toBe(false);
  });

  it("has no coach key until one is set", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    expect(await getCoachKeyEnc(env.DB)).toBeNull();
  });

  it("saves and clears a coach key", async () => {
    await saveAthlete(env.DB, {
      id: 42, access_token: "a", refresh_token: "r", expires_at: 100, connected: true,
    });
    await setCoachKeyEnc(env.DB, "ciphertext-blob");
    expect(await getCoachKeyEnc(env.DB)).toBe("ciphertext-blob");

    await setCoachKeyEnc(env.DB, null);
    expect(await getCoachKeyEnc(env.DB)).toBeNull();
  });
});
