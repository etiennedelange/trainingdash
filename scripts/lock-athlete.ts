/**
 * Lock ALLOWED_ATHLETE_ID in wrangler.jsonc to whichever Strava athlete is
 * currently connected in the LOCAL dev D1 database.
 *
 *   pnpm lock-athlete
 *
 * Run this once after connecting with your own Strava account, so a stray
 * OAuth completion (e.g. while a cloudflared tunnel is exposed for webhook
 * testing) can never again claim the instance instead of you — see
 * worker/strava/oauth.ts's gate: "An explicit ALLOWED_ATHLETE_ID always
 * wins." This only edits the local wrangler.jsonc; set the same value as a
 * production var (or re-run against a deployed instance's own config)
 * before deploying.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

interface D1Result {
  results: { id: number }[];
}

const raw = execFileSync(
  "pnpm",
  ["exec", "wrangler", "d1", "execute", "trainingdash", "--local", "--json", "--command", "SELECT id FROM athlete LIMIT 1"],
  { encoding: "utf8" },
);

const [result] = JSON.parse(raw) as D1Result[];
const athleteId = result?.results[0]?.id;

if (athleteId === undefined) {
  console.error("No athlete connected in the local dev database — connect via `pnpm dev` first.");
  process.exit(1);
}

const path = "wrangler.jsonc";
const config = readFileSync(path, "utf8");
const updated = config.replace(
  /"ALLOWED_ATHLETE_ID":\s*"[^"]*"/,
  `"ALLOWED_ATHLETE_ID": "${athleteId}"`,
);

if (updated === config) {
  console.error(`Could not find an ALLOWED_ATHLETE_ID field to update in ${path}.`);
  process.exit(1);
}

writeFileSync(path, updated);
console.log(`Locked ALLOWED_ATHLETE_ID to ${athleteId} in ${path}.`);
