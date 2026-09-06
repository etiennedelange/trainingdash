import { Hono } from "hono";
import type { Env } from "./env";
import auth from "./routes/auth";
import webhook from "./routes/webhook";

export { LiveRoom } from "./live/room";

const app = new Hono<{ Bindings: Env }>();

app.get("/api/health", (c) => c.json({ ok: true }));
app.route("/auth", auth);
app.route("/webhook", webhook);

export default app;
