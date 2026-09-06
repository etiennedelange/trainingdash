import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import type { Env } from "./env";
import auth from "./routes/auth";
import api from "./routes/api";
import webhook from "./routes/webhook";
import { verifySession, SESSION_COOKIE } from "./session";

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

export default app;
