import type { BackfillState } from "#shared/types";

const DEFAULT: BackfillState = { page: 1, complete: false, last_error: null };

export async function getBackfillState(db: D1Database): Promise<BackfillState> {
  const r = await db
    .prepare("SELECT value FROM sync_state WHERE key = 'backfill'")
    .first<{ value: string }>();
  if (!r) return { ...DEFAULT };
  return { ...DEFAULT, ...(JSON.parse(r.value) as Partial<BackfillState>) };
}

export async function setBackfillState(db: D1Database, s: BackfillState): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_state (key, value) VALUES ('backfill', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .bind(JSON.stringify(s))
    .run();
}

/**
 * Separate from BackfillState itself: this only throttles how often normal
 * traffic is allowed to kick off a continuation run (see api.ts), so it's
 * read/written independently rather than riding along on the state object
 * the client also sees.
 */
export async function getLastBackfillAttempt(db: D1Database): Promise<number> {
  const r = await db
    .prepare("SELECT value FROM sync_state WHERE key = 'backfill_attempt'")
    .first<{ value: string }>();
  return r ? Number(r.value) : 0;
}

export async function markBackfillAttempt(db: D1Database, at: number): Promise<void> {
  await db
    .prepare(
      `INSERT INTO sync_state (key, value) VALUES ('backfill_attempt', ?1)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .bind(String(at))
    .run();
}
