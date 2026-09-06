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
