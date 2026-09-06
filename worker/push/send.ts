// Web Push is signed and encrypted per RFC 8291/8292.
// @block65/webcrypto-web-push does both via WebCrypto (no Node `crypto`),
// confirmed to run inside workerd before adopting it — do not reimplement
// either the signing or the encryption.
import { buildPushPayload, type PushSubscription, type VapidKeys } from "@block65/webcrypto-web-push";
import type { Env } from "../env";
import type { ActivityRow } from "#shared/types";
import { listPushSubscriptions, deletePushSubscription, type PushSubscriptionRow } from "../db/push";

function toVapidKeys(env: Env): VapidKeys {
  return {
    subject: env.VAPID_SUBJECT,
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
}

function toPushSubscription(row: PushSubscriptionRow): PushSubscription {
  return {
    endpoint: row.endpoint,
    expirationTime: null,
    keys: row.keys,
  };
}

async function buildPushRequest(env: Env, row: PushSubscriptionRow, payload: string): Promise<Request> {
  const init = await buildPushPayload({ data: payload }, toPushSubscription(row), toVapidKeys(env));
  return new Request(row.endpoint, init);
}

/**
 * Best-effort notification. Never allowed to affect the D1 write or the
 * WebSocket broadcast — a failure here is logged and dropped.
 */
export async function notifyActivity(env: Env, activity: ActivityRow): Promise<void> {
  const subs = await listPushSubscriptions(env.DB);
  if (subs.length === 0) return;

  const payload = JSON.stringify({
    title: `${activity.sport_type} uploaded`,
    body: `${(activity.distance / 1000).toFixed(2)} km`,
    url: `/activity/${activity.id}`,
  });

  await Promise.all(
    subs.map(async (sub) => {
      try {
        const request = await buildPushRequest(env, sub, payload);
        const res = await fetch(request);
        // 404/410 mean the browser dropped the subscription — stop retrying it.
        if (res.status === 404 || res.status === 410) {
          await deletePushSubscription(env.DB, sub.endpoint);
        }
      } catch (err) {
        console.error("push send failed", sub.endpoint, err);
      }
    }),
  );
}
