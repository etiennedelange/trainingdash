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
 *
 * Pass --real instead of --owner-id/--object-id to auto-fill both from your
 * local D1 (the connected athlete row + your most recent activity), so
 * create/update trigger a genuine Strava fetch+upsert+broadcast without you
 * having to look ids up by hand:
 *
 *   pnpm webhook:update
 *   pnpm webhook:delete
 *   pnpm webhook:create
 */
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

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
  real: boolean;
}

function parseArgs(argv: string[]): Flags {
  const flags: Flags = { url: "http://localhost:5173/webhook", count: 1, real: false };
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
      case "--real":
        flags.real = true;
        break;
      default:
        rest.push(arg);
    }
  }
  if (rest[0]) flags.url = rest[0];
  return flags;
}

/** Runs a read-only query against the local D1 database via wrangler. */
function queryLocalD1<T>(sql: string): T[] {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "trainingdash", "--local", "--json", "--command", sql], {
    encoding: "utf8",
  });
  const [{ results }] = JSON.parse(out) as [{ results: T[] }];
  return results;
}

/** Fills owner-id/object-id from the connected athlete + their latest activity in local D1. */
function fillFromLocalD1(flags: Flags): void {
  if (!flags.ownerId) {
    const [athlete] = queryLocalD1<{ id: number }>("SELECT id FROM athlete LIMIT 1");
    if (!athlete) {
      console.error("No athlete connected in local D1 — connect one first, or pass --owner-id.");
      process.exit(1);
    }
    flags.ownerId = athlete.id;
  }
  if (!flags.objectId) {
    const [activity] = queryLocalD1<{ id: number; name: string }>(
      "SELECT id, name FROM activities ORDER BY start_date DESC, id DESC LIMIT 1",
    );
    if (!activity) {
      console.error("No activities in local D1 — sync one first, or pass --object-id.");
      process.exit(1);
    }
    flags.objectId = activity.id;
    console.log(`Using latest local activity: ${activity.id} (${activity.name})`);
  }
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
if (flags.real) fillFromLocalD1(flags);

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
