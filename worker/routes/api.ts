import { Hono } from "hono";
import type { Env } from "../env";
import type { ActivityDetail, ActivityExtra, ActivitySummary } from "#shared/types";
import type { StravaActivity } from "../strava/types";
import { requireSession } from "../middleware/require-session";
import { getAthlete } from "../db/athlete";
import { listActivities, getActivity } from "../db/activities";
import { getBackfillState } from "../db/sync";
import { savePushSubscription } from "../db/push";
import { listWebhookEvents } from "../db/webhook-log";
import coach from "./coach";

const api = new Hono<{ Bindings: Env; Variables: { athleteId: number } }>();

/**
 * Detail-only fields (calories, splits, best efforts) only exist in `raw`
 * for activities fetched individually via a webhook create/update — the
 * bulk backfill endpoint returns a slimmer shape. Parsing the already-stored
 * `raw` column back out is cheap (one JSON.parse of a value already in
 * memory from the row we just fetched); no extra Strava call is made.
 */
function extractExtra(raw: string): ActivityExtra | null {
  try {
    const a = JSON.parse(raw) as StravaActivity;
    return {
      calories: a.calories ?? null,
      average_cadence: a.average_cadence ?? null,
      average_watts: a.average_watts ?? null,
      weighted_average_watts: a.weighted_average_watts ?? null,
      device_watts: a.device_watts ?? null,
      elev_high: a.elev_high ?? null,
      elev_low: a.elev_low ?? null,
      kudos_count: a.kudos_count ?? null,
      achievement_count: a.achievement_count ?? null,
      pr_count: a.pr_count ?? null,
      splits_metric: a.splits_metric ?? null,
      best_efforts: a.best_efforts ?? null,
    };
  } catch {
    return null;
  }
}

api.use("*", requireSession);

api.get("/me", async (c) => {
  const athlete = await getAthlete(c.env.DB);
  return c.json({
    athleteId: c.get("athleteId"),
    connected: athlete?.connected ?? false,
    backfill: await getBackfillState(c.env.DB),
    vapidPublicKey: c.env.VAPID_PUBLIC_KEY,
  });
});

api.get("/activities", async (c) => {
  const rows = await listActivities(c.env.DB);
  const summaries: ActivitySummary[] = rows.map(({ raw: _raw, polyline: _poly, ...rest }) => rest);
  return c.json(summaries);
});

api.get("/activities/:id", async (c) => {
  const id = Number(c.req.param("id"));
  if (!Number.isInteger(id)) return c.json({ error: "bad id" }, 400);
  const row = await getActivity(c.env.DB, id);
  if (!row) return c.json({ error: "not found" }, 404);
  const { raw, ...rest } = row;
  return c.json({ ...rest, extra: extractExtra(raw) } satisfies ActivityDetail);
});

api.post("/push/subscribe", async (c) => {
  const body = (await c.req.json()) as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  if (!body.endpoint || !body.keys?.p256dh || !body.keys.auth) {
    return c.json({ error: "malformed subscription" }, 400);
  }
  await savePushSubscription(c.env.DB, {
    endpoint: body.endpoint,
    keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
  });
  return c.json({ ok: true });
});

api.get("/webhook-events", async (c) => {
  return c.json(await listWebhookEvents(c.env.DB));
});

api.route("/coach", coach);

export default api;
