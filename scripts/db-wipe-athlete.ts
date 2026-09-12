/**
 * Wipe the connected athlete, their activities, and backfill state from the
 * LOCAL dev D1 database — never touches --remote/production.
 *
 *   pnpm db:wipe-athlete
 *
 * Use this when the wrong Strava account got connected locally (possible
 * whenever ALLOWED_ATHLETE_ID is empty in wrangler.jsonc — see
 * worker/strava/oauth.ts's single-athlete gate and the README's warning
 * that "the first athlete to complete OAuth claims the instance"). After
 * running this, reconnect with the right account and, if you want to lock
 * it in, run `pnpm lock-athlete`.
 *
 * Leaves push_subscriptions alone — those are per-browser, not per-athlete,
 * and unrelated to which Strava account is connected.
 */
import { execFileSync } from "node:child_process";

function run(sql: string): void {
  execFileSync(
    "pnpm",
    ["exec", "wrangler", "d1", "execute", "trainingdash", "--local", "--command", sql],
    { stdio: "inherit" },
  );
}

console.log("Wiping local dev D1: activities, athlete, backfill state...");
run("DELETE FROM activities");
run("DELETE FROM athlete");
run("DELETE FROM sync_state WHERE key = 'backfill'");
console.log("Done. Reconnect via `pnpm dev` -> Connect with Strava.");
