import { queryOptions } from "@tanstack/react-query";
import type { ActivitySummary, ActivityDetail, BackfillState } from "#shared/types";
import { apiGet } from "./api";

export interface Me {
  athleteId: number;
  connected: boolean;
  backfill: BackfillState;
  vapidPublicKey: string;
}

export const queryKeys = {
  me: ["me"] as const,
  activities: ["activities"] as const,
  activity: (id: number) => ["activity", id] as const,
  coachKey: ["coach", "key"] as const,
};

export const meQuery = queryOptions({
  queryKey: queryKeys.me,
  queryFn: () => apiGet<Me>("/api/me"),
});

export const activitiesQuery = queryOptions({
  queryKey: queryKeys.activities,
  queryFn: () => apiGet<ActivitySummary[]>("/api/activities"),
  // The whole history is a few megabytes and only changes on a push.
  staleTime: 5 * 60 * 1000,
});

export const activityQuery = (id: number) =>
  queryOptions({
    queryKey: queryKeys.activity(id),
    queryFn: () => apiGet<ActivityDetail>(`/api/activities/${id}`),
  });

export interface CoachKeyStatus {
  hasKey: boolean;
  source: "byok" | "env" | "none";
}

export const coachKeyQuery = queryOptions({
  queryKey: queryKeys.coachKey,
  queryFn: () => apiGet<CoachKeyStatus>("/api/coach/key"),
});
