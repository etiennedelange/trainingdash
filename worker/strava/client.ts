import type { Env } from "../env";
import type { AthleteRecord } from "#shared/types";
import { getAthlete, saveAthlete, setConnected } from "../db/athlete";
import type { StravaActivity, StravaTokenResponse } from "./types";

const BASE = "https://www.strava.com";

export interface RateLimit {
  shortUsage: number;
  shortLimit: number;
  dailyUsage: number;
  dailyLimit: number;
}

export class RateLimitError extends Error {
  constructor() {
    super("Strava rate limit reached");
    this.name = "RateLimitError";
  }
}

export class TokenRefreshError extends Error {
  constructor(status: number) {
    super(`Strava refused the refresh token (HTTP ${status})`);
    this.name = "TokenRefreshError";
  }
}

export function parseRateLimit(headers: Headers): RateLimit | null {
  const limit = headers.get("X-RateLimit-Limit");
  const usage = headers.get("X-RateLimit-Usage");
  if (!limit || !usage) return null;
  const l = limit.split(",").map(Number);
  const u = usage.split(",").map(Number);
  const [shortLimit, dailyLimit] = [l[0], l[1]];
  const [shortUsage, dailyUsage] = [u[0], u[1]];
  if (
    shortLimit === undefined || dailyLimit === undefined ||
    shortUsage === undefined || dailyUsage === undefined
  ) return null;
  return { shortUsage, shortLimit, dailyUsage, dailyLimit };
}

export function isNearLimit(r: RateLimit | null): boolean {
  if (!r) return false;
  return r.shortUsage / r.shortLimit >= 0.9 || r.dailyUsage / r.dailyLimit >= 0.9;
}

export class StravaClient {
  lastRateLimit: RateLimit | null = null;

  private constructor(
    private token: string,
    readonly athleteId: number,
  ) {}

  static async create(env: Env): Promise<StravaClient | null> {
    const athlete = await getAthlete(env.DB);
    if (!athlete) return null;

    const now = Math.floor(Date.now() / 1000);
    const token =
      athlete.expires_at > now + 60
        ? athlete.access_token
        : await StravaClient.refresh(env, athlete);

    return new StravaClient(token, athlete.id);
  }

  private static async refresh(env: Env, athlete: AthleteRecord): Promise<string> {
    const res = await fetch(`${BASE}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: env.STRAVA_CLIENT_ID,
        client_secret: env.STRAVA_CLIENT_SECRET,
        grant_type: "refresh_token",
        refresh_token: athlete.refresh_token,
      }),
    });

    if (!res.ok) {
      await setConnected(env.DB, athlete.id, false);
      throw new TokenRefreshError(res.status);
    }

    const t = (await res.json()) as StravaTokenResponse;
    await saveAthlete(env.DB, {
      id: athlete.id,
      access_token: t.access_token,
      refresh_token: t.refresh_token,
      expires_at: t.expires_at,
      connected: true,
    });
    return t.access_token;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    this.lastRateLimit = parseRateLimit(res.headers);
    if (res.status === 429) throw new RateLimitError();
    if (!res.ok) throw new Error(`Strava GET ${path} failed: ${res.status}`);
    return (await res.json()) as T;
  }

  async getActivity(id: number): Promise<StravaActivity> {
    return await this.get<StravaActivity>(`/api/v3/activities/${id}`);
  }

  async listActivities(page: number, perPage: number): Promise<StravaActivity[]> {
    return await this.get<StravaActivity[]>(
      `/api/v3/athlete/activities?page=${page}&per_page=${perPage}`,
    );
  }
}
