import type { ActivitySummary } from "./types";

export interface Totals {
  count: number;
  distance: number;
  movingTime: number;
  elevation: number;
}

export interface Streak {
  current: number;
  longest: number;
  lastActiveDate: string | null;
}

export interface WeekBucket {
  weekStart: string;
  distance: number;
  movingTime: number;
  count: number;
}

export interface SportSlice {
  sport: string;
  count: number;
  distance: number;
  pct: number;
}

export interface DayGroup {
  date: string;
  rows: ActivitySummary[];
}

/** Dates are YYYY-MM-DD strings throughout — never Date objects, which drag
 *  the runner's timezone into results that are already local by construction. */
function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function mondayOf(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = d.getUTCDay(); // 0 = Sunday
  return addDays(date, dow === 0 ? -6 : 1 - dow);
}

export function activeDays(rows: ActivitySummary[]): string[] {
  return [...new Set(rows.map((r) => r.local_date))].sort();
}

export function computeStreak(rows: ActivitySummary[], today: string): Streak {
  const days = activeDays(rows);
  if (days.length === 0) return { current: 0, longest: 0, lastActiveDate: null };

  let longest = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = days[i - 1];
    const cur = days[i];
    if (prev === undefined || cur === undefined) continue;
    run = addDays(prev, 1) === cur ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  const last = days[days.length - 1] ?? null;

  // Today with no activity yet does not end a streak; the day before does.
  let anchor: string | null = null;
  if (last === today) anchor = today;
  else if (last === addDays(today, -1)) anchor = last;

  let current = 0;
  if (anchor) {
    const set = new Set(days);
    let cursor = anchor;
    while (set.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }

  return { current, longest, lastActiveDate: last };
}

export function weeklyBuckets(
  rows: ActivitySummary[],
  weeks: number,
  today: string,
): WeekBucket[] {
  const thisMonday = mondayOf(today);
  const starts: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) starts.push(addDays(thisMonday, -7 * i));

  const buckets = new Map<string, WeekBucket>(
    starts.map((weekStart) => [weekStart, { weekStart, distance: 0, movingTime: 0, count: 0 }]),
  );

  for (const r of rows) {
    const bucket = buckets.get(mondayOf(r.local_date));
    if (!bucket) continue;
    bucket.distance += r.distance;
    bucket.movingTime += r.moving_time;
    bucket.count += 1;
  }

  return starts.map((s) => buckets.get(s)!);
}

export function sportMix(rows: ActivitySummary[]): SportSlice[] {
  if (rows.length === 0) return [];

  const by = new Map<string, { count: number; distance: number }>();
  for (const r of rows) {
    const cur = by.get(r.sport_type) ?? { count: 0, distance: 0 };
    cur.count += 1;
    cur.distance += r.distance;
    by.set(r.sport_type, cur);
  }

  const slices = [...by.entries()]
    .map(([sport, v]) => ({ sport, ...v, pct: 0 }))
    .sort((x, y) => y.count - x.count || x.sport.localeCompare(y.sport));

  // Largest-remainder, so the percentages always total exactly 100.
  const exact = slices.map((s) => (s.count / rows.length) * 100);
  const floors = exact.map(Math.floor);
  let remainder = 100 - floors.reduce((n, f) => n + f, 0);
  const order = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((x, y) => y.frac - x.frac);

  for (const { i } of order) {
    if (remainder <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    remainder -= 1;
  }

  return slices.map((s, i) => ({ ...s, pct: floors[i] ?? 0 }));
}

/** Rows arrive newest-first (the API's own ORDER BY start_date DESC) and this
 *  preserves that order — it chunks consecutive same-day rows, it never sorts. */
export function groupByDay(rows: ActivitySummary[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.date === row.local_date) {
      last.rows.push(row);
    } else {
      groups.push({ date: row.local_date, rows: [row] });
    }
  }
  return groups;
}

export function totalsBetween(
  rows: ActivitySummary[],
  from: string,
  to: string,
): Totals {
  const totals: Totals = { count: 0, distance: 0, movingTime: 0, elevation: 0 };
  for (const r of rows) {
    if (r.local_date < from || r.local_date > to) continue;
    totals.count += 1;
    totals.distance += r.distance;
    totals.movingTime += r.moving_time;
    totals.elevation += r.total_elevation_gain ?? 0;
  }
  return totals;
}
