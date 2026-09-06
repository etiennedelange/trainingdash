/**
 * Manage the single Strava webhook subscription this application is allowed.
 *
 *   pnpm webhook list
 *   pnpm webhook create https://<public-host>/webhook
 *   pnpm webhook delete <id>
 *
 * Reads credentials from .dev.vars.
 */
import { readFileSync } from "node:fs";

const ENDPOINT = "https://www.strava.com/api/v3/push_subscriptions";

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
const verifyToken = env.STRAVA_VERIFY_TOKEN;

if (!clientId || !clientSecret || !verifyToken) {
  console.error("Missing STRAVA_CLIENT_ID, STRAVA_CLIENT_SECRET or STRAVA_VERIFY_TOKEN in .dev.vars");
  process.exit(1);
}

const [command, arg] = process.argv.slice(2);

async function list(): Promise<void> {
  const q = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret! });
  const res = await fetch(`${ENDPOINT}?${q}`);
  console.log(res.status, JSON.stringify(await res.json(), null, 2));
}

async function create(callbackUrl: string): Promise<void> {
  const body = new URLSearchParams({
    client_id: clientId!,
    client_secret: clientSecret!,
    callback_url: callbackUrl,
    verify_token: verifyToken!,
  });
  const res = await fetch(ENDPOINT, { method: "POST", body });
  const text = await res.text();
  console.log(res.status, text);
  if (!res.ok) {
    console.error(
      "\nIf this says a subscription already exists, run `pnpm webhook list` then " +
        "`pnpm webhook delete <id>`.\nIf it says the callback failed validation, " +
        "check that GET /webhook answers within two seconds with the challenge as JSON.",
    );
  }
}

async function remove(id: string): Promise<void> {
  const q = new URLSearchParams({ client_id: clientId!, client_secret: clientSecret! });
  const res = await fetch(`${ENDPOINT}/${id}?${q}`, { method: "DELETE" });
  console.log(res.status, await res.text());
}

switch (command) {
  case "list":
    await list();
    break;
  case "create":
    if (!arg) {
      console.error("usage: pnpm webhook create https://<host>/webhook");
      process.exit(1);
    }
    await create(arg);
    break;
  case "delete":
    if (!arg) {
      console.error("usage: pnpm webhook delete <id>");
      process.exit(1);
    }
    await remove(arg);
    break;
  default:
    console.error("usage: pnpm webhook <list|create <url>|delete <id>>");
    process.exit(1);
}
