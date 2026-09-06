/**
 * Send synthetic Strava webhook event(s) to a running worker, per Strava's
 * own testing guidance (there is no hosted mock/sandbox service — you POST
 * a hand-built payload to your callback URL and check it acks with 200 and
 * processes correctly): https://developers.strava.com/docs/webhooks/
 *
 *   pnpm mock-webhook
 *   pnpm mock-webhook http://localhost:5173/webhook
 *   pnpm mock-webhook --aspect delete --object-id 123 --owner-id 456
 *   pnpm mock-webhook --count 5
 *
 * Reads STRAVA_VERIFY_TOKEN from .dev.vars and appends it as the callback
 * URL's final path segment, mirroring scripts/webhook.ts and what
 * worker/routes/webhook.ts expects on every POST.
 *
 * worker/sync/ingest.ts only acts on object_type "activity" whose owner_id
 * matches the single connected athlete row in D1 — anything else is acked
 * with 200 and silently ignored. Pass --owner-id to match a real connected
 * athlete if you want create/update to actually fetch+upsert; otherwise
 * this only exercises the ack path (still useful — it's most of what
 * webhook.test.ts already covers offline).
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

const verifyToken = loadEnv().STRAVA_VERIFY_TOKEN;
if (!verifyToken) {
  console.error("Missing STRAVA_VERIFY_TOKEN in .dev.vars");
  process.exit(1);
}

interface Flags {
  url: string;
  aspect?: "create" | "update" | "delete";
  objectType?: "activity" | "athlete";
  objectId?: number;
  ownerId?: number;
  count: number;
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { url: "http://localhost:5173/webhook", count: 1 };
  const rest: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--aspect":
        flags.aspect = argv[++i] as Flags["aspect"];
        break;
      case "--object-type":
        flags.objectType = argv[++i] as Flags["objectType"];
        break;
      case "--object-id":
        flags.objectId = Number(argv[++i]);
        break;
      case "--owner-id":
        flags.ownerId = Number(argv[++i]);
        break;
      case "--count":
        flags.count = Number(argv[++i]);
        break;
      default:
        rest.push(arg);
    }
  }
  if (rest[0]) flags.url = rest[0];
  return flags;
}

const ASPECTS = ["create", "update", "delete"] as const;
const UPDATE_FIELDS = [
  { title: "Morning Run" },
  { type: "Run" },
  { private: "true" },
] as const;

function randomInt(max: number): number {
  return Math.floor(Math.random() * max) + 1;
}

function pick<T>(options: readonly T[]): T {
  return options[Math.floor(Math.random() * options.length)];
}

function buildEvent(flags: Flags) {
  const aspectType = flags.aspect ?? pick(ASPECTS);
  return {
    object_type: flags.objectType ?? "activity",
    object_id: flags.objectId ?? randomInt(1_000_000_000),
    aspect_type: aspectType,
    owner_id: flags.ownerId ?? randomInt(100_000_000),
    subscription_id: randomInt(1_000_000),
    event_time: Math.floor(Date.now() / 1000),
    updates: aspectType === "update" ? pick(UPDATE_FIELDS) : {},
  };
}

async function send(url: string, event: ReturnType<typeof buildEvent>): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(event),
  });
  console.log(JSON.stringify(event));
  console.log(`  -> ${res.status} ${await res.text()}`);
}

const flags = parseArgs(process.argv.slice(2));
const base = flags.url.replace(/\/$/, "");
const target = base.endsWith(`/${verifyToken}`) ? base : `${base}/${verifyToken}`;

if (!flags.ownerId) {
  console.warn(
    "No --owner-id given: a random owner_id won't match the connected athlete, " +
      "so the worker will ack 200 but skip processing (see worker/sync/ingest.ts).\n",
  );
}

for (let i = 0; i < flags.count; i++) {
  await send(target, buildEvent(flags));
}
