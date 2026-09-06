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
 */
webhook.post("/", async (c) => {
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
