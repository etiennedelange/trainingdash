import { createMiddleware } from "hono/factory";
import { getCookie } from "hono/cookie";
import type { Env } from "../env";
import { verifySession, SESSION_COOKIE } from "../session";

export const requireSession = createMiddleware<{
  Bindings: Env;
  Variables: { athleteId: number };
}>(async (c, next) => {
  const athleteId = await verifySession(getCookie(c, SESSION_COOKIE), c.env.SESSION_SECRET);
  if (athleteId === null) return c.json({ error: "unauthorized" }, 401);
  c.set("athleteId", athleteId);
  await next();
});
