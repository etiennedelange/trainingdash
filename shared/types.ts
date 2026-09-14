export interface ActivityRow {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  local_date: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain: number | null;
  average_speed: number | null;
  average_heartrate: number | null;
  suffer_score: number | null;
  polyline: string | null;
  raw: string;
  updated_at: number;
}

export interface AthleteRecord {
  id: number;
  access_token: string;
  refresh_token: string;
  expires_at: number;
  connected: boolean;
}

export interface BackfillState {
  page: number;
  complete: boolean;
  last_error: string | null;
}

export interface WebhookEventLog {
  id: number;
  received_at: number;
  kind: "validate" | "event";
  object_type: string | null;
  object_id: number | null;
  aspect_type: string | null;
  owner_id: number | null;
  outcome: string;
  detail: string | null;
  payload: string | null;
  activity_raw: string | null;
}

export type ActivitySummary = Omit<ActivityRow, "raw" | "polyline">;

/**
 * Fields only present in Strava's single-activity detail response (fetched
 * on webhook create/update), never the bulk list endpoint used for backfill —
 * so on activities only ever synced in bulk this is null. Derived from the
 * `raw` column already stored per activity; no extra Strava call needed to
 * serve it.
 */
export interface ActivityExtra {
  calories: number | null;
  average_cadence: number | null;
  average_watts: number | null;
  weighted_average_watts: number | null;
  device_watts: boolean | null;
  elev_high: number | null;
  elev_low: number | null;
  kudos_count: number | null;
  achievement_count: number | null;
  pr_count: number | null;
  splits_metric: { distance: number; elapsed_time: number; moving_time: number; average_speed: number }[] | null;
  best_efforts: { name: string; distance: number; elapsed_time: number; moving_time: number }[] | null;
}

/** One activity in full. `raw` is server-only and never reaches the client. */
export type ActivityDetail = Omit<ActivityRow, "raw"> & { extra: ActivityExtra | null };

export type LiveMessage =
  | { type: "activity.upsert"; activity: ActivityRow; aspect: "create" | "update" }
  | { type: "activity.delete"; id: number };
