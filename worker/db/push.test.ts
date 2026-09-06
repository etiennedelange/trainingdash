import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { savePushSubscription, listPushSubscriptions, deletePushSubscription } from "./push";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
});

const sub = {
  endpoint: "https://push.example/abc",
  keys: { p256dh: "key", auth: "auth" },
};

describe("push subscriptions", () => {
  it("saves and lists", async () => {
    await savePushSubscription(env.DB, sub);
    const all = await listPushSubscriptions(env.DB);
    expect(all).toHaveLength(1);
    expect(all[0]?.keys.p256dh).toBe("key");
  });

  it("is idempotent on the same endpoint", async () => {
    await savePushSubscription(env.DB, sub);
    await savePushSubscription(env.DB, sub);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(1);
  });

  it("deletes by endpoint", async () => {
    await savePushSubscription(env.DB, sub);
    await deletePushSubscription(env.DB, sub.endpoint);
    expect(await listPushSubscriptions(env.DB)).toHaveLength(0);
  });
});
