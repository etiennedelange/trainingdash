import type { LiveRoom } from "./live/room";

export interface Env {
  DB: D1Database;
  LIVE: DurableObjectNamespace<LiveRoom>;
  ASSETS: Fetcher;
  APP_URL: string;
  ALLOWED_ATHLETE_ID: string;
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  STRAVA_VERIFY_TOKEN: string;
  SESSION_SECRET: string;
}
