import { Hono } from "hono";
import type { Env } from "../env";
import type { ActivitySummary } from "#shared/types";
import { requireSession } from "../middleware/require-session";
import { getAthlete } from "../db/athlete";
import { listActivities, getActivity } from "../db/activities";
import { getBackfillState } from "../db/sync";

const api = new Hono<{ Bindings: Env; Variables: { athleteId: number } }>();

api.use("*", requireSession);

api.get("/me", async (c) => {
  const athlete = await getAthlete(c.env.DB);
  return c.json({
    athleteId: c.get("athleteId"),
    connected: athlete?.connected ?? false,
    backfill: await getBackfillState(c.env.DB),
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
  return c.json(row);
});

export default api;
