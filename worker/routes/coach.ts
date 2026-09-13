import { Hono } from "hono";
import type { Env } from "../env";
import { loadDigest } from "../coach/digest";
import { streamCoachReply, type CoachTurn } from "../coach/chat";
import { encryptApiKey, decryptApiKey } from "../coach/keyCrypto";
import { getCoachKeyEnc, setCoachKeyEnc } from "../db/athlete";

const coach = new Hono<{ Bindings: Env; Variables: { athleteId: number } }>();

// A loose shape check, not real validation against Anthropic — just enough
// to reject an obviously wrong paste (empty, a Strava token, etc.).
function looksLikeAnthropicKey(value: unknown): value is string {
  return typeof value === "string" && /^sk-ant-[A-Za-z0-9_-]{10,200}$/.test(value);
}

coach.get("/key", async (c) => {
  const enc = await getCoachKeyEnc(c.env.DB);
  const source = enc !== null ? "byok" : c.env.ANTHROPIC_API_KEY ? "env" : "none";
  return c.json({ hasKey: source !== "none", source });
});

coach.put("/key", async (c) => {
  let body: { apiKey?: unknown };
  try {
    body = (await c.req.json()) as { apiKey?: unknown };
  } catch {
    return c.json({ error: "malformed body" }, 400);
  }
  if (!looksLikeAnthropicKey(body.apiKey)) return c.json({ error: "malformed api key" }, 400);

  const enc = await encryptApiKey(body.apiKey, c.env.SESSION_SECRET);
  await setCoachKeyEnc(c.env.DB, enc);
  return c.json({ ok: true });
});

coach.delete("/key", async (c) => {
  await setCoachKeyEnc(c.env.DB, null);
  return c.json({ ok: true });
});

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
    if (role === "user" && content.length > 4000) return null;
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

  const storedEnc = await getCoachKeyEnc(c.env.DB);
  const storedKey = storedEnc ? await decryptApiKey(storedEnc, c.env.SESSION_SECRET) : null;
  const apiKey = storedKey ?? c.env.ANTHROPIC_API_KEY;
  if (!apiKey) return c.json({ error: "no_api_key" }, 412);

  // Built here, from D1. Anything resembling a digest in the request body is
  // ignored: the client supplies questions, never facts.
  const digest = await loadDigest(c.env.DB, today);

  const stream = await streamCoachReply(apiKey, digest, turns);

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});

export default coach;
