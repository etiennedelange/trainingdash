import { env, SELF } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { signSession } from "../session";
import { listPushSubscriptions } from "../db/push";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
});

async function post(body: unknown, withSession = true): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSession) headers.Cookie = `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
  return await SELF.fetch("http://example.com/api/push/subscribe", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

describe("POST /api/push/subscribe", () => {
  it("401s without a session", async () => {
    const res = await post({ endpoint: "https://p/1", keys: { p256dh: "a", auth: "b" } }, false);
    expect(res.status).toBe(401);
  });

  it("stores a valid subscription", async () => {
    const res = await post({ endpoint: "https://p/1", keys: { p256dh: "a", auth: "b" } });
    expect(res.status).toBe(200);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(1);
  });

  it("400s a malformed subscription", async () => {
    expect((await post({ endpoint: "https://p/1" })).status).toBe(400);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(0);
  });
});
