import { Hono } from "hono";
import type { Env } from "../env";
import { handleEvent, type StravaWebhookEvent } from "../sync/ingest";

const webhook = new Hono<{ Bindings: Env }>();

/**
 * Subscription validation. Strava requires a 200 within two seconds carrying
 * the challenge echoed as JSON — a slow or malformed reply here is the most
 * common reason subscription creation fails.
 */
webhook.get("/", (c) => {
  const mode = c.req.query("hub.mode");
  const token = c.req.query("hub.verify_token");
  const challenge = c.req.query("hub.challenge");

  if (mode !== "subscribe" || token !== c.env.STRAVA_VERIFY_TOKEN || !challenge) {
    return c.json({ error: "forbidden" }, 403);
  }
  return c.json({ "hub.challenge": challenge });
});

/**
 * Event receipt. Acknowledge first, work second: the two-second deadline is
 * far shorter than a Strava fetch plus a D1 write.
 *
 * Strava does not sign webhook payloads, and `owner_id` alone is public
 * (visible in any Strava profile URL), so it cannot authenticate a request.
 * Instead the registered callback URL carries `?token=<STRAVA_VERIFY_TOKEN>`
 * (see scripts/webhook.ts) and Strava echoes that same query string on every
 * delivery, not just at subscription-validation time. A missing or wrong
 * token still gets a 200 — same "ack anyway, don't process" shape as a
 * malformed body — so a prober can't distinguish "wrong token" from
 * "processed" by status code, and Strava's retry/health checks (which expect
 * 200) are unaffected even if this is ever misconfigured.
 */
webhook.post("/", async (c) => {
  if (c.req.query("token") !== c.env.STRAVA_VERIFY_TOKEN) {
    return c.json({ ok: true });
  }

  let event: StravaWebhookEvent | null = null;
  try {
    event = (await c.req.json()) as StravaWebhookEvent;
  } catch {
    // A body we cannot parse is still acknowledged; retrying it would not help.
    return c.json({ ok: true });
  }

  const e = event;
  c.executionCtx.waitUntil(
    handleEvent(c.env, e).catch((err) => console.error("ingest failed", err)),
  );

  return c.json({ ok: true });
});

export default webhook;
