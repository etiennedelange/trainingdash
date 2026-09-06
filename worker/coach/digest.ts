import type { ActivitySummary } from "#shared/types";
import { computeStreak, weeklyBuckets, sportMix, totalsBetween } from "#shared/aggregate";
import { listActivities } from "../db/activities";

const WINDOW_DAYS = 30;

function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

const km = (metres: number) => (metres / 1000).toFixed(1);

function hhmm(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

/**
 * Renders the last 30 days as a stable block of text.
 *
 * DETERMINISM IS A CORRECTNESS REQUIREMENT, not a nicety. This string sits in
 * the cached prompt prefix, and prompt caching is a prefix match — a single
 * varying byte means every follow-up turn re-pays for the whole digest. So:
 * sort everything, derive every date from the `today` argument, and never
 * call Date.now() or Math.random() here.
 */
export function buildDigest(rows: ActivitySummary[], today: string): string {
  const from = addDays(today, -(WINDOW_DAYS - 1));
  const recent = rows
    .filter((r) => r.local_date >= from && r.local_date <= today)
    .sort((x, y) => (x.local_date === y.local_date ? x.id - y.id : x.local_date < y.local_date ? 1 : -1));

  const lines: string[] = [];
  lines.push(`Training summary for the ${WINDOW_DAYS} days ending ${today}.`);
  lines.push("");

  if (recent.length === 0) {
    lines.push("No activities recorded in this window.");
    return lines.join("\n");
  }

  const totals = totalsBetween(recent, from, today);
  const streak = computeStreak(rows, today);

  lines.push("## Totals");
  lines.push(`- Activities: ${totals.count}`);
  lines.push(`- Distance: ${km(totals.distance)} km`);
  lines.push(`- Moving time: ${hhmm(totals.movingTime)}`);
  lines.push(`- Elevation gain: ${Math.round(totals.elevation)} m`);
  lines.push(`- Streak: ${streak.current} days (longest ever ${streak.longest})`);
  lines.push("");

  lines.push("## Sport mix");
  for (const s of sportMix(recent)) {
    lines.push(`- ${s.sport}: ${s.count} activities, ${km(s.distance)} km (${s.pct}%)`);
  }
  lines.push("");

  lines.push("## Weekly distance");
  for (const w of weeklyBuckets(recent, 5, today)) {
    lines.push(`- Week of ${w.weekStart}: ${km(w.distance)} km over ${w.count} activities`);
  }
  lines.push("");

  lines.push("## Activities");
  for (const r of recent) {
    const parts = [
      r.local_date,
      r.sport_type,
      r.name,
      `${km(r.distance)} km`,
      hhmm(r.moving_time),
    ];
    if (r.average_heartrate) parts.push(`${Math.round(r.average_heartrate)} bpm avg`);
    if (r.total_elevation_gain) parts.push(`${Math.round(r.total_elevation_gain)} m gain`);
    lines.push(`- ${parts.join(" · ")}`);
  }

  return lines.join("\n");
}

export async function loadDigest(db: D1Database, today: string): Promise<string> {
  const rows = await listActivities(db);
  const summaries: ActivitySummary[] = rows.map(({ raw: _r, polyline: _p, ...rest }) => rest);
  return buildDigest(summaries, today);
}
