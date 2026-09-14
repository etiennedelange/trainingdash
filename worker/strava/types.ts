export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  moving_time: number;
  average_speed: number;
  elevation_difference?: number | null;
}

export interface StravaBestEffort {
  name: string;
  distance: number;
  elapsed_time: number;
  moving_time: number;
}

export interface StravaActivity {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  elapsed_time: number;
  moving_time: number;
  distance: number;
  total_elevation_gain?: number | null;
  average_speed?: number | null;
  average_heartrate?: number | null;
  suffer_score?: number | null;
  map?: { summary_polyline?: string | null } | null;
  // Only present on the single-activity detail endpoint (client.getActivity),
  // not the list endpoint used for backfill — so these are absent on
  // activities that have only ever been synced in bulk.
  calories?: number | null;
  average_cadence?: number | null;
  average_watts?: number | null;
  weighted_average_watts?: number | null;
  device_watts?: boolean | null;
  elev_high?: number | null;
  elev_low?: number | null;
  kudos_count?: number | null;
  achievement_count?: number | null;
  pr_count?: number | null;
  splits_metric?: StravaSplit[] | null;
  best_efforts?: StravaBestEffort[] | null;
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}
