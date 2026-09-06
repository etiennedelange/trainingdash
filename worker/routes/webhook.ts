import { Hono } from "hono";
import type { Env } from "../env";
import { handleEvent, type StravaWebhookEvent } from "../sync/ingest";

const webhook = new Hono<{ Bindings: Env }>();

/**
 * The token lives in the URL PATH, not a query param. Strava's subscription
 * API naively concatenates its own `?hub.*` params onto whatever callback
 * URL is registered — using a literal `?` even when the URL already has one
 * (confirmed in production: a registered `?token=x` URL comes back as
 * `?token=x?hub.verify_token=...`, silently swallowing hub.verify_token into
 * the value of `token`). A path segment is untouched by that concatenation,
 * so it survives regardless of how carelessly Strava appends query params.
 *
 * Subscription validation. Strava requires a 200 within two seconds carrying
 * the challenge echoed as JSON — a slow or malformed reply here is the most
 * common reason subscription creation fails.
 */
webhook.get("/:token", (c) => {
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
 * Instead the registered callback URL carries `/<STRAVA_VERIFY_TOKEN>` as its
 * final path segment (see scripts/webhook.ts) and Strava replays that same
 * URL on every delivery, not just at subscription-validation time. A missing
 * or wrong token still gets a 200 — same "ack anyway, don't process" shape as
 * a malformed body — so a prober can't distinguish "wrong token" from
 * "processed" by status code, and Strava's retry/health checks (which expect
 * 200) are unaffected even if this is ever misconfigured.
 */
webhook.post("/:token", async (c) => {
  if (c.req.param("token") !== c.env.STRAVA_VERIFY_TOKEN) {
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
