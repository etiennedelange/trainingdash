import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import type { Env } from "../env";
import { buildAuthorizeUrl, exchangeCode, athleteAllowed } from "../strava/oauth";
import { saveAthlete } from "../db/athlete";
import { signSession, SESSION_COOKIE } from "../session";
import { StravaClient } from "../strava/client";
import { runBackfill } from "../sync/backfill";

const auth = new Hono<{ Bindings: Env }>();

auth.get("/login", (c) => c.redirect(buildAuthorizeUrl(c.env), 302));

auth.get("/callback", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "missing code" }, 400);

  const token = await exchangeCode(c.env, code);
  const athleteId = token.athlete?.id;
  if (!athleteId) return c.json({ error: "no athlete in token response" }, 400);

  if (!(await athleteAllowed(c.env, athleteId))) {
    return c.json({ error: "this instance belongs to another athlete" }, 403);
  }

  await saveAthlete(c.env.DB, {
    id: athleteId,
    access_token: token.access_token,
    refresh_token: token.refresh_token,
    expires_at: token.expires_at,
    connected: true,
  });

  setCookie(c, SESSION_COOKIE, await signSession(athleteId, c.env.SESSION_SECRET), {
    httpOnly: true,
    secure: c.env.APP_URL.startsWith("https"),
    sameSite: "Lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  c.executionCtx.waitUntil(
    (async () => {
      const client = await StravaClient.create(c.env);
      if (client) await runBackfill(c.env, client);
    })().catch((err) => console.error("backfill failed", err)),
  );

  return c.redirect("/", 302);
});

auth.post("/logout", (c) => {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
  return c.json({ ok: true });
});

export default auth;
