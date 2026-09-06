import type { ActivityRow } from "#shared/types";
import type { StravaActivity } from "./types";

export function toRow(a: StravaActivity): ActivityRow {
  return {
    id: a.id,
    name: a.name,
    sport_type: a.sport_type,
    start_date: a.start_date,
    local_date: a.start_date_local.slice(0, 10),
    elapsed_time: a.elapsed_time,
    moving_time: a.moving_time,
    distance: a.distance,
    total_elevation_gain: a.total_elevation_gain ?? null,
    average_speed: a.average_speed ?? null,
    average_heartrate: a.average_heartrate ?? null,
    suffer_score: a.suffer_score ?? null,
    polyline: a.map?.summary_polyline ?? null,
    raw: JSON.stringify(a),
    updated_at: Math.floor(Date.now() / 1000),
  };
}
