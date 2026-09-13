import type { AthleteRecord } from "#shared/types";

interface AthleteDbRow {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  connected: number;
}

export async function getAthlete(db: D1Database): Promise<AthleteRecord | null> {
  const r = await db
    .prepare(
      "SELECT id, access_token, refresh_token, expires_at, connected FROM athlete ORDER BY id LIMIT 1",
    )
    .first<AthleteDbRow>();
  return r ? { ...r, connected: r.connected === 1 } : null;
}

export async function saveAthlete(db: D1Database, rec: AthleteRecord): Promise<void> {
  await db
    .prepare(
      `INSERT INTO athlete (id, access_token, refresh_token, expires_at, connected)
       VALUES (?1,?2,?3,?4,?5)
       ON CONFLICT(id) DO UPDATE SET
         access_token=excluded.access_token, refresh_token=excluded.refresh_token,
         expires_at=excluded.expires_at, connected=excluded.connected`,
    )
    .bind(rec.id, rec.access_token, rec.refresh_token, rec.expires_at, rec.connected ? 1 : 0)
    .run();
}

export async function setConnected(db: D1Database, id: number, connected: boolean): Promise<void> {
  await db
    .prepare("UPDATE athlete SET connected = ?2 WHERE id = ?1")
    .bind(id, connected ? 1 : 0)
    .run();
}

export async function getCoachKeyEnc(db: D1Database): Promise<string | null> {
  const r = await db
    .prepare("SELECT anthropic_api_key_enc FROM athlete ORDER BY id LIMIT 1")
    .first<{ anthropic_api_key_enc: string | null }>();
  return r?.anthropic_api_key_enc ?? null;
}

/** Updates the one athlete row regardless of id, mirroring getCoachKeyEnc's
 *  "there is only ever one row" read — so this never silently no-ops if a
 *  caller's id doesn't match the row (e.g. a stale/foreign session id). */
export async function setCoachKeyEnc(db: D1Database, enc: string | null): Promise<void> {
  await db
    .prepare("UPDATE athlete SET anthropic_api_key_enc = ?1 WHERE id = (SELECT id FROM athlete ORDER BY id LIMIT 1)")
    .bind(enc)
    .run();
}
