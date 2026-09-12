/**
 * Fetch GET /api/me from a running dev server — connection state, backfill
 * progress, and VAPID key — without going through the browser.
 *
 *   pnpm me
 *   pnpm me https://<tunnel-host>
 *
 * /api/me sits behind requireSession (worker/middleware/require-session.ts),
 * and getAthlete (worker/db/athlete.ts) always returns the single connected
 * athlete row regardless of the athleteId in the cookie — so this signs a
 * throwaway session with SESSION_SECRET from .dev.vars, mirroring
 * worker/session.ts's signSession, rather than needing a real browser login.
 */
import { readFileSync } from "node:fs";

function loadEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of readFileSync(".dev.vars", "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^["']|["']$/g, "");
  }
  return out;
}

async function signSession(athleteId: number, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const payload = String(athleteId);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const hex = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${payload}.${hex}`;
}

const sessionSecret = loadEnv().SESSION_SECRET;
if (!sessionSecret) {
  console.error("Missing SESSION_SECRET in .dev.vars");
  process.exit(1);
}

const base = (process.argv[2] ?? "http://localhost:5173").replace(/\/$/, "");
const cookie = await signSession(1, sessionSecret);

const res = await fetch(`${base}/api/me`, { headers: { Cookie: `sd_session=${cookie}` } });
const body = await res.text();

if (!res.ok) {
  console.error(`GET /api/me -> ${res.status}\n${body}`);
  process.exit(1);
}

console.log(JSON.stringify(JSON.parse(body), null, 2));
