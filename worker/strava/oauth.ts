import type { Env } from "../env";
import { getAthlete } from "../db/athlete";
import type { StravaTokenResponse } from "./types";

const BASE = "https://www.strava.com";

export function buildAuthorizeUrl(env: Env): string {
  const params = new URLSearchParams({
    client_id: env.STRAVA_CLIENT_ID,
    redirect_uri: `${env.APP_URL}/auth/callback`,
    response_type: "code",
    scope: "activity:read_all",
    approval_prompt: "auto",
  });
  return `${BASE}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCode(env: Env, code: string): Promise<StravaTokenResponse> {
  const res = await fetch(`${BASE}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
      grant_type: "authorization_code",
      code,
    }),
  });
  if (!res.ok) throw new Error(`Strava code exchange failed: ${res.status}`);
  return (await res.json()) as StravaTokenResponse;
}

/**
 * The single-athlete gate. An explicit ALLOWED_ATHLETE_ID always wins.
 * Otherwise the first athlete to connect claims the instance, and anyone
 * who follows is refused.
 */
export async function athleteAllowed(env: Env, id: number): Promise<boolean> {
  if (env.ALLOWED_ATHLETE_ID) return String(id) === env.ALLOWED_ATHLETE_ID;
  const existing = await getAthlete(env.DB);
  return existing === null || existing.id === id;
}
