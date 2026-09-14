export interface WebhookLogEntry {
  kind: "validate" | "event";
  object_type?: string | null;
  object_id?: number | null;
  aspect_type?: string | null;
  owner_id?: number | null;
  outcome: string;
  detail?: string | null;
  payload?: string | null;
  activity_raw?: string | null;
}

export interface WebhookLogRow extends WebhookLogEntry {
  id: number;
  received_at: number;
  payload: string | null;
  activity_raw: string | null;
}

export async function logWebhookEvent(db: D1Database, entry: WebhookLogEntry): Promise<void> {
  await db
    .prepare(
      `INSERT INTO webhook_events (received_at, kind, object_type, object_id, aspect_type, owner_id, outcome, detail, payload, activity_raw)
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)`,
    )
    .bind(
      Date.now(),
      entry.kind,
      entry.object_type ?? null,
      entry.object_id ?? null,
      entry.aspect_type ?? null,
      entry.owner_id ?? null,
      entry.outcome,
      entry.detail ?? null,
      entry.payload ?? null,
      entry.activity_raw ?? null,
    )
    .run();
}

export async function listWebhookEvents(db: D1Database, limit = 50): Promise<WebhookLogRow[]> {
  const { results } = await db
    .prepare(
      `SELECT id, received_at, kind, object_type, object_id, aspect_type, owner_id, outcome, detail, payload, activity_raw
       FROM webhook_events ORDER BY received_at DESC LIMIT ?1`,
    )
    .bind(limit)
    .all<WebhookLogRow>();
  return results;
}
