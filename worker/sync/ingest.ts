import type { Env } from "../env";
import type { ActivityRow } from "#shared/types";
import { StravaClient } from "../strava/client";
import { toRow } from "../strava/map";
import { upsertActivity, deleteActivity } from "../db/activities";
import { getAthlete } from "../db/athlete";
import { broadcast } from "../live/room";
import { notifyActivity } from "../push/send";

export interface StravaWebhookEvent {
  object_type: "activity" | "athlete";
  object_id: number;
  aspect_type: "create" | "update" | "delete";
  owner_id: number;
  subscription_id: number;
  event_time: number;
  updates: Record<string, string>;
}

/**
 * One event, one row change. Runs inside ctx.waitUntil() — the webhook has
 * already answered 200 by the time this executes, so a throw here loses the
 * event and nothing more. The client's refetch-on-visibility closes the gap.
 */
export async function handleEvent(env: Env, event: StravaWebhookEvent): Promise<ActivityRow | null> {
  if (event.object_type !== "activity") return null;

  const athlete = await getAthlete(env.DB);
  if (!athlete || athlete.id !== event.owner_id) return null;

  if (event.aspect_type === "delete") {
    await deleteActivity(env.DB, event.object_id);
    await broadcast(env, { type: "activity.delete", id: event.object_id });
    return null;
  }

  const client = await StravaClient.create(env);
  if (!client) return null;

  const row = toRow(await client.getActivity(event.object_id));
  await upsertActivity(env.DB, row);
  const aspect = event.aspect_type === "create" ? "create" : "update";
  await broadcast(env, { type: "activity.upsert", activity: row, aspect });
  // A push telling the athlete an activity was "uploaded" only makes sense
  // for a genuinely new activity — an edit (e.g. renaming on Strava) still
  // fires this same webhook and would otherwise re-announce it as new.
  if (aspect === "create") {
    await notifyActivity(env, row).catch((err) => console.error("notify failed", err));
  }
  return row;
}
