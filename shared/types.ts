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

export type ActivitySummary = Omit<ActivityRow, "raw" | "polyline">;

/** One activity in full. `raw` is server-only and never reaches the client. */
export type ActivityDetail = Omit<ActivityRow, "raw">;

export type LiveMessage =
  | { type: "activity.upsert"; activity: ActivityRow }
  | { type: "activity.delete"; id: number };
