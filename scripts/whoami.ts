/**
 * Find YOUR real Strava athlete id directly from Strava's OAuth API —
 * independent of whatever this app's local D1 currently has connected
 * (useful after the wrong account got connected locally; see
 * scripts/db-wipe-athlete.ts and scripts/lock-athlete.ts).
 *
 *   pnpm whoami
 *
 * This does a standalone OAuth code exchange (Strava's own quickstart
 * pattern: https://developers.strava.com/docs/getting-started/#oauth) using
 * a throwaway redirect_uri your browser doesn't need to resolve — Strava
 * only checks the redirect_uri's domain against the app's "Authorization
 * Callback Domain" setting (usually just "localhost"), so the browser
 * landing on an unreachable page is expected; the athlete id is already in
 * the URL bar's `code=` param by then.
 *
 * Does NOT touch this app's D1, sessions, or the real /auth/callback route
 * — it only calls Strava's oauth/token endpoint directly, exactly like
 * scripts/webhook.ts and scripts/mock-webhook.ts already read .dev.vars.
 */
import { readFileSync } from "node:fs";
import { createInterface } from "node:readline/promises";

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

const env = loadEnv();
const clientId = env.STRAVA_CLIENT_ID;
const clientSecret = env.STRAVA_CLIENT_SECRET;
if (!clientId || !clientSecret) {
  console.error("Missing STRAVA_CLIENT_ID / STRAVA_CLIENT_SECRET in .dev.vars");
  process.exit(1);
}

const REDIRECT_URI = "http://localhost/exchange_token";
const authorizeUrl = `https://www.strava.com/oauth/authorize?${new URLSearchParams({
  client_id: clientId,
  redirect_uri: REDIRECT_URI,
  response_type: "code",
  scope: "read",
  approval_prompt: "auto",
})}`;

console.log("1. Open this URL and log in with YOUR Strava account:\n");
console.log(`   ${authorizeUrl}\n`);
console.log("2. Click Authorize. The browser will land on a page that fails to");
console.log(`   load (${REDIRECT_URI}?...) — that's expected, just copy the`);
console.log("   `code=` value from the address bar.\n");

const rl = createInterface({ input: process.stdin, output: process.stdout });
const code = (await rl.question("Paste the code here: ")).trim();
rl.close();

if (!code) {
  console.error("No code provided.");
  process.exit(1);
}

const res = await fetch("https://www.strava.com/api/v3/oauth/token", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    grant_type: "authorization_code",
  }),
});

const body = await res.text();
if (!res.ok) {
  console.error(`Strava token exchange failed: ${res.status}\n${body}`);
  process.exit(1);
}

const token = JSON.parse(body) as { athlete?: { id: number; firstname: string; lastname: string } };
if (!token.athlete) {
  console.error(`No athlete in response:\n${body}`);
  process.exit(1);
}

console.log(`\nYour Strava athlete id: ${token.athlete.id} (${token.athlete.firstname} ${token.athlete.lastname})`);
