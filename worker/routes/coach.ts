import { Hono } from "hono";
import type { Env } from "../env";
import { loadDigest } from "../coach/digest";
import { streamCoachReply, type CoachTurn } from "../coach/chat";

const coach = new Hono<{ Bindings: Env; Variables: { athleteId: number } }>();

interface CoachRequest {
  turns?: unknown;
  today?: unknown;
}

function parseTurns(value: unknown): CoachTurn[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;

  const turns: CoachTurn[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const { role, content } = item as { role?: unknown; content?: unknown };
    if ((role !== "user" && role !== "assistant") || typeof content !== "string") return null;
    if (content.length > 4000) return null;
    turns.push({ role, content });
  }

  // Opus 5 rejects an assistant prefill, so the conversation must end on the user.
  if (turns[turns.length - 1]?.role !== "user") return null;
  return turns;
}

coach.post("/", async (c) => {
  let body: CoachRequest;
  try {
    body = (await c.req.json()) as CoachRequest;
  } catch {
    return c.json({ error: "malformed body" }, 400);
  }

  const turns = parseTurns(body.turns);
  if (!turns) return c.json({ error: "malformed turns" }, 400);

  const today = body.today;
  if (typeof today !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return c.json({ error: "malformed today" }, 400);
  }

  // Built here, from D1. Anything resembling a digest in the request body is
  // ignored: the client supplies questions, never facts.
  const digest = await loadDigest(c.env.DB, today);

  const stream = await streamCoachReply(c.env, digest, turns);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

export default coach;
