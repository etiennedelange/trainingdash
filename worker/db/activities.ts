import type { ActivityRow } from "#shared/types";

const COLUMNS = `id, name, sport_type, start_date, local_date, elapsed_time,
  moving_time, distance, total_elevation_gain, average_speed, average_heartrate,
  suffer_score, polyline, raw, updated_at`;

export function upsertActivityStatement(db: D1Database, row: ActivityRow): D1PreparedStatement {
  return db
    .prepare(
      `INSERT INTO activities (${COLUMNS})
       VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)
       ON CONFLICT(id) DO UPDATE SET
         name=excluded.name, sport_type=excluded.sport_type,
         start_date=excluded.start_date, local_date=excluded.local_date,
         elapsed_time=excluded.elapsed_time, moving_time=excluded.moving_time,
         distance=excluded.distance, total_elevation_gain=excluded.total_elevation_gain,
         average_speed=excluded.average_speed, average_heartrate=excluded.average_heartrate,
         suffer_score=excluded.suffer_score, polyline=excluded.polyline,
         raw=excluded.raw, updated_at=excluded.updated_at`,
    )
    .bind(
      row.id, row.name, row.sport_type, row.start_date, row.local_date,
      row.elapsed_time, row.moving_time, row.distance, row.total_elevation_gain,
      row.average_speed, row.average_heartrate, row.suffer_score, row.polyline,
      row.raw, row.updated_at,
    );
}

export async function upsertActivity(db: D1Database, row: ActivityRow): Promise<void> {
  await upsertActivityStatement(db, row).run();
}

export async function deleteActivity(db: D1Database, id: number): Promise<void> {
  await db.prepare("DELETE FROM activities WHERE id = ?1").bind(id).run();
}

export async function getActivity(db: D1Database, id: number): Promise<ActivityRow | null> {
  return await db
    .prepare(`SELECT ${COLUMNS} FROM activities WHERE id = ?1`)
    .bind(id)
    .first<ActivityRow>();
}

export async function listActivities(db: D1Database): Promise<ActivityRow[]> {
  const { results } = await db
    .prepare(`SELECT ${COLUMNS} FROM activities ORDER BY start_date DESC, id DESC`)
    .all<ActivityRow>();
  return results;
}
