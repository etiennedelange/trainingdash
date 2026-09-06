import type { Env } from "../env";
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
export async function handleEvent(env: Env, event: StravaWebhookEvent): Promise<void> {
  if (event.object_type !== "activity") return;

  const athlete = await getAthlete(env.DB);
  if (!athlete || athlete.id !== event.owner_id) return;

  if (event.aspect_type === "delete") {
    await deleteActivity(env.DB, event.object_id);
    await broadcast(env, { type: "activity.delete", id: event.object_id });
    return;
  }

  const client = await StravaClient.create(env);
  if (!client) return;

  const row = toRow(await client.getActivity(event.object_id));
  await upsertActivity(env.DB, row);
  await broadcast(env, { type: "activity.upsert", activity: row });
  await notifyActivity(env, row).catch((err) => console.error("notify failed", err));
}
