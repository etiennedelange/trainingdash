export interface PushKeys {
  p256dh: string;
  auth: string;
}

export interface PushSubscriptionRow {
  endpoint: string;
  keys: PushKeys;
  created_at: number;
}

export async function savePushSubscription(
  db: D1Database,
  sub: { endpoint: string; keys: PushKeys },
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO push_subscriptions (endpoint, keys, created_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(endpoint) DO UPDATE SET keys = excluded.keys`,
    )
    .bind(sub.endpoint, JSON.stringify(sub.keys), Math.floor(Date.now() / 1000))
    .run();
}

export async function listPushSubscriptions(db: D1Database): Promise<PushSubscriptionRow[]> {
  const { results } = await db
    .prepare("SELECT endpoint, keys, created_at FROM push_subscriptions")
    .all<{ endpoint: string; keys: string; created_at: number }>();
  return results.map((r) => ({ ...r, keys: JSON.parse(r.keys) as PushKeys }));
}

export async function deletePushSubscription(db: D1Database, endpoint: string): Promise<void> {
  await db.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?1").bind(endpoint).run();
}
