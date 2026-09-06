import type { Env } from "../env";
import type { BackfillState } from "#shared/types";
import { StravaClient, RateLimitError, isNearLimit } from "../strava/client";
import { toRow } from "../strava/map";
import { upsertActivity } from "../db/activities";
import { getBackfillState, setBackfillState } from "../db/sync";

export const PER_PAGE = 200;

/**
 * Imports history newest-first, saving the resume point after every page.
 * Returns rather than retries when Strava pushes back: the scheduled handler
 * picks the run up again later.
 *
 * Completion is detected by an empty page, not a partial one: a page with
 * fewer than PER_PAGE results can still be non-final in principle, so the
 * loop always makes one further request and only stops once Strava returns
 * nothing.
 */
export async function runBackfill(env: Env, client: StravaClient): Promise<BackfillState> {
  const state = await getBackfillState(env.DB);
  if (state.complete) return state;

  let page = state.page;

  for (;;) {
    let batch;
    try {
      batch = await client.listActivities(page, PER_PAGE);
    } catch (err) {
      const next: BackfillState = {
        page,
        complete: false,
        last_error: err instanceof RateLimitError ? "rate limit reached" : String(err),
      };
      await setBackfillState(env.DB, next);
      return next;
    }

    for (const a of batch) {
      await upsertActivity(env.DB, toRow(a));
    }

    if (batch.length === 0) {
      const done: BackfillState = { page, complete: true, last_error: null };
      await setBackfillState(env.DB, done);
      return done;
    }

    page += 1;

    if (isNearLimit(client.lastRateLimit)) {
      const paused: BackfillState = {
        page,
        complete: false,
        last_error: "paused near rate limit",
      };
      await setBackfillState(env.DB, paused);
      return paused;
    }

    await setBackfillState(env.DB, { page, complete: false, last_error: null });
  }
}
