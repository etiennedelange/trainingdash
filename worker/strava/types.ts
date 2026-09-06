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
}

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  athlete?: { id: number };
}
