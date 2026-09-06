import { env, SELF } from "cloudflare:test";
import { describe, it, expect } from "vitest";

describe("worker", () => {
  it("answers the health check", async () => {
    const res = await SELF.fetch("http://example.com/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("has its bindings", () => {
    expect(env.DB).toBeDefined();
    expect(env.LIVE).toBeDefined();
  });
});
