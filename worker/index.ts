import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "./env";
import auth from "./routes/auth";
import api from "./routes/api";
import webhook from "./routes/webhook";
import { verifySession, SESSION_COOKIE } from "./session";
import { getBackfillState } from "./db/sync";
import { StravaClient } from "./strava/client";
import { runBackfill } from "./sync/backfill";

export { LiveRoom } from "./live/room";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/auth", auth);
app.route("/api", api);
app.route("/webhook", webhook);

app.get("/live", async (c) => {
  const athleteId = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET);
  if (athleteId === null) return c.json({ error: "unauthorized" }, 401);
  if (c.req.header("Upgrade") !== "websocket") {
    return c.text("Expected WebSocket", 426);
  }
  const stub = c.env.LIVE.getByName("live");
  return await stub.fetch("http://do/connect", { headers: { Upgrade: "websocket" } });
});

// Catch-all: everything not matched above (the SPA shell, static assets) is
// served from the built dist/. Registered last so it never shadows a route
// above it — Hono matches in registration order.
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(
      (async () => {
        const state = await getBackfillState(env.DB);
        if (state.complete) return;
        const client = await StravaClient.create(env);
        if (!client) return;
        await runBackfill(env, client);
      })().catch((err) => console.error("scheduled backfill failed", err)),
    );
  },
} satisfies ExportedHandler<Env>;
