import { useCallback, useState } from "react";

const STORAGE_KEY = "trainingdash:weekly-goal-km";

function readGoal(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * The athlete's weekly distance goal in kilometres, persisted in
 * localStorage. Client-side by design: this is one athlete's own target on
 * their own browser, and it makes the arrival hero's "what it means" line
 * concrete — "62% of this week's 30 km" — instead of purely comparative.
 */
export function useWeeklyGoal(): [number | null, (km: number | null) => void] {
  const [goal, setGoalState] = useState<number | null>(() => readGoal());

  const setGoal = useCallback((km: number | null) => {
    if (km === null) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, String(km));
    }
    setGoalState(km);
  }, []);

  return [goal, setGoal];
}