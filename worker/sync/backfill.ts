import type { Env } from "../env";
import type { BackfillState } from "#shared/types";
import { StravaClient, RateLimitError, isNearLimit } from "../strava/client";
import { toRow } from "../strava/map";
import { upsertActivityStatement } from "../db/activities";
import { getBackfillState, setBackfillState } from "../db/sync";

export const PER_PAGE = 200;

// A hard ceiling on how long one invocation keeps paging, independent of
// Strava's own rate-limit signals: the platform's own CPU/wall-clock limits
// can kill a long-running invocation outright, before it ever gets a chance
// to persist state or hit isNearLimit — which used to leave the backfill
// silently wedged, re-doing (and never getting past) the same first page on
// every retry. Bailing out early and saving progress keeps that recoverable.
const TIME_BUDGET_MS = 20_000;

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
  const deadline = Date.now() + TIME_BUDGET_MS;

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

    // One round trip per page rather than one per activity: besides being
    // far cheaper, it's what keeps a full page's worth of writes from
    // running the invocation past its time budget before it can save
    // progress.
    if (batch.length > 0) {
      await env.DB.batch(batch.map((a) => upsertActivityStatement(env.DB, toRow(a))));
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

    const next: BackfillState = { page, complete: false, last_error: null };
    await setBackfillState(env.DB, next);

    if (Date.now() > deadline) return next;
  }
}
