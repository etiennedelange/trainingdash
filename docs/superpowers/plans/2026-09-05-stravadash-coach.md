# Stravadash Coach Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A chat screen that answers questions about the last 30 days of training, streamed token by token, grounded in a digest the Worker builds from D1 rather than anything the client asserts.

**Architecture:** `POST /api/coach` takes only conversation turns. The Worker reads D1, composes a deterministic training digest, puts it in the cached system prefix, and streams Claude's reply back as SSE.

**Tech Stack:** `@anthropic-ai/sdk` with `claude-opus-5`, Hono streaming, React.

**Spec:** `docs/superpowers/specs/2026-09-05-stravadash-design.md` — §4.6 in particular.

**Plan 3 of 3.** Requires Plan 1 (pipeline) and Plan 2 (`shared/aggregate.ts` especially) complete and green.

## Global Constraints

- **The digest is built server-side and never accepted from the client.** The request body carries conversation turns and nothing else. A client-supplied digest would let the page assert any training history it liked and turn the endpoint into a relay to a paid API.
- **The digest must be deterministic.** Sorted keys, no `Date.now()`, no random or per-request ids. Prompt caching is a prefix match; one volatile byte and the cache silently never hits, and every follow-up turn re-pays for the whole digest.
- **Model is `claude-opus-5`.** Do not substitute a cheaper model — that is the user's decision, not the implementer's.
- **`budget_tokens` must not appear anywhere.** It is removed on Opus 5 and returns a 400. Thinking is configured as `{ type: "adaptive" }`, depth via `output_config.effort`.
- **No assistant prefill** — it returns a 400 on Opus 5. Steer response shape with the system prompt.
- **Streaming is required**, so a long answer cannot hit an HTTP timeout.
- **No tool use.** The digest is computed before the call, so the model needs no database access and the endpoint stays one request rather than an agent loop.
- **`ANTHROPIC_API_KEY` is a Worker secret**, the route sits behind the session guard, and the single-athlete gate means only the owner can spend it.
- **No test may call the real API.** Every test stubs the SDK.
- **Commit after every task.**

## File Structure

| File | Responsibility |
|---|---|
| `worker/coach/digest.ts` | D1 rows → deterministic training digest string |
| `worker/coach/prompt.ts` | The stable system instructions |
| `worker/coach/chat.ts` | The Anthropic streaming call |
| `worker/routes/coach.ts` | `POST /api/coach`, SSE response |
| `src/routes/coach.tsx` | The chat screen |
| `src/hooks/useCoachStream.ts` | Client-side SSE consumption |

---

### Task 1: The deterministic training digest

**Files:**
- Create: `worker/coach/digest.ts`
- Test: `worker/coach/digest.test.ts`

**Interfaces:**
- Consumes: `ActivitySummary` (Plan 1), `computeStreak`, `weeklyBuckets`, `sportMix`, `totalsBetween` (Plan 2, Task 2), `listActivities` (Plan 1, Task 2).
- Produces:
  - `buildDigest(rows: ActivitySummary[], today: string): string`
  - `loadDigest(db: D1Database, today: string): Promise<string>`

- [ ] **Step 1: Write the failing test**

The determinism test is the load-bearing one — prompt caching depends on it.

`worker/coach/digest.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildDigest } from "./digest";
import type { ActivitySummary } from "#shared/types";

const a = (local_date: string, over: Partial<ActivitySummary> = {}): ActivitySummary => ({
  id: 1, name: "Evening Run", sport_type: "Run",
  start_date: `${local_date}T18:41:00Z`, local_date,
  elapsed_time: 2052, moving_time: 2052, distance: 6420,
  total_elevation_gain: 48, average_speed: 3.13, average_heartrate: 152,
  suffer_score: 40, updated_at: 1,
  ...over,
});

const rows = [
  a("2026-09-06", { id: 1 }),
  a("2026-09-05", { id: 2, sport_type: "Ride", distance: 24000 }),
  a("2026-09-03", { id: 3, sport_type: "WeightTraining", distance: 0 }),
];

describe("buildDigest", () => {
  it("is byte-identical across repeated calls with the same input", () => {
    expect(buildDigest(rows, "2026-09-06")).toBe(buildDigest(rows, "2026-09-06"));
  });

  it("is byte-identical regardless of input row order", () => {
    const shuffled = [rows[2]!, rows[0]!, rows[1]!];
    expect(buildDigest(shuffled, "2026-09-06")).toBe(buildDigest(rows, "2026-09-06"));
  });

  it("contains no timestamp or random token that would break the cache", () => {
    const digest = buildDigest(rows, "2026-09-06");
    // A unix timestamp near now would defeat prefix caching entirely.
    expect(digest).not.toMatch(/\b17\d{8,}\b/);
    expect(digest).not.toMatch(/\b\d{13}\b/);
  });

  it("includes the streak, weekly totals and sport mix", () => {
    const digest = buildDigest(rows, "2026-09-06");
    expect(digest).toContain("Streak");
    expect(digest).toContain("Run");
    expect(digest).toContain("Ride");
  });

  it("only covers the last 30 days", () => {
    const withOld = [...rows, a("2020-01-01", { id: 9, name: "Ancient Run" })];
    expect(buildDigest(withOld, "2026-09-06")).not.toContain("Ancient Run");
  });

  it("produces a usable digest from an empty history", () => {
    const digest = buildDigest([], "2026-09-06");
    expect(digest).toContain("No activities");
    expect(digest).toBe(buildDigest([], "2026-09-06"));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run worker/coach/digest.test.ts`
Expected: FAIL — module `./digest` not found.

- [ ] **Step 3: Write `worker/coach/digest.ts`**

```ts
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
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm exec vitest run worker/coach/digest.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: add the deterministic coach training digest"
```

---

### Task 2: The Anthropic streaming call

**Files:**
- Create: `worker/coach/prompt.ts`, `worker/coach/chat.ts`
- Modify: `worker/env.ts`
- Test: `worker/coach/chat.test.ts`

**Interfaces:**
- Consumes: `Env`, `buildDigest`.
- Produces:
  - `SYSTEM_INSTRUCTIONS: string`
  - `CoachTurn = { role: "user" | "assistant"; content: string }`
  - `streamCoachReply(env, digest, turns): Promise<ReadableStream<Uint8Array>>`

- [ ] **Step 1: Install and configure**

```bash
pnpm add @anthropic-ai/sdk
```

Add to `worker/env.ts`:

```ts
  ANTHROPIC_API_KEY: string;
```

Add `ANTHROPIC_API_KEY=sk-ant-...` to `.dev.vars`.

- [ ] **Step 2: Write `worker/coach/prompt.ts`**

These instructions are frozen. They sit at the very front of the cached prefix, so editing them invalidates every cached conversation — change them deliberately, not casually.

```ts
export const SYSTEM_INSTRUCTIONS = `You are a training coach embedded in a personal exercise dashboard.

You are given a summary of the athlete's last 30 days of training, taken
directly from their Strava history. Answer their questions about it.

Guidelines:
- Ground every claim in the summary. If it does not contain what you would need,
  say so plainly rather than estimating.
- Be concise. Two or three short paragraphs at most, usually less.
- Use the athlete's own units (kilometres, minutes per kilometre).
- You are not a doctor. Do not diagnose injuries or give medical advice; suggest
  they see a professional when a question calls for one.
- Do not invent activities, dates, or numbers that are absent from the summary.`;
```

- [ ] **Step 3: Write the failing test**

`worker/coach/chat.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { streamCoachReply } from "./chat";
import { env } from "cloudflare:test";

const create = vi.fn();

vi.mock("@anthropic-ai/sdk", () => ({
  default: class {
    messages = { create: (...args: unknown[]) => create(...args) };
  },
}));

function fakeStream() {
  return new ReadableStream({
    start(controller) {
      controller.enqueue({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "You ran " },
      });
      controller.enqueue({
        type: "content_block_delta",
        delta: { type: "text_delta", text: "32 km." },
      });
      controller.close();
    },
  });
}

beforeEach(() => {
  create.mockReset();
  create.mockResolvedValue(fakeStream());
});

async function drain(stream: ReadableStream<Uint8Array>): Promise<string> {
  return await new Response(stream).text();
}

describe("streamCoachReply", () => {
  it("uses claude-opus-5", async () => {
    await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ model: "claude-opus-5" });
  });

  it("streams", async () => {
    await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    expect(create.mock.calls[0]?.[0]).toMatchObject({ stream: true });
  });

  it("uses adaptive thinking and never sends budget_tokens", async () => {
    await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    const params = create.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(params.thinking).toEqual({ type: "adaptive" });
    // budget_tokens is removed on Opus 5 and returns a 400.
    expect(JSON.stringify(params)).not.toContain("budget_tokens");
  });

  it("sends no assistant prefill — the last turn is always the user's", async () => {
    await streamCoachReply(env, "DIGEST", [
      { role: "user", content: "hi" },
      { role: "assistant", content: "hello" },
      { role: "user", content: "and?" },
    ]);
    const params = create.mock.calls[0]?.[0] as { messages: { role: string }[] };
    expect(params.messages[params.messages.length - 1]?.role).toBe("user");
  });

  it("puts the digest in the cached system prefix, not in the messages", async () => {
    await streamCoachReply(env, "DIGEST-MARKER", [{ role: "user", content: "hi" }]);
    const params = create.mock.calls[0]?.[0] as {
      system: { type: string; text: string; cache_control?: unknown }[];
      messages: { content: string }[];
    };
    const systemText = params.system.map((b) => b.text).join("\n");
    expect(systemText).toContain("DIGEST-MARKER");
    expect(params.messages.some((m) => m.content.includes("DIGEST-MARKER"))).toBe(false);
    // The last system block carries the breakpoint so the whole prefix caches.
    expect(params.system[params.system.length - 1]?.cache_control).toEqual({ type: "ephemeral" });
  });

  it("emits the text deltas as SSE data lines", async () => {
    const stream = await streamCoachReply(env, "DIGEST", [{ role: "user", content: "hi" }]);
    const text = await drain(stream);
    expect(text).toContain("You ran ");
    expect(text).toContain("32 km.");
    expect(text).toContain("data: ");
  });
});
```

- [ ] **Step 4: Run it to verify it fails**

Run: `pnpm exec vitest run worker/coach/chat.test.ts`
Expected: FAIL — module `./chat` not found.

- [ ] **Step 5: Write `worker/coach/chat.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Env } from "../env";
import { SYSTEM_INSTRUCTIONS } from "./prompt";

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * One streamed reply.
 *
 * Requests render as tools -> system -> messages, and a cache breakpoint is a
 * prefix match. The frozen instructions and the digest therefore go in
 * `system` behind one cache_control breakpoint, and only the varying question
 * sits after it — so every follow-up turn reads the digest from cache instead
 * of paying for it again.
 */
export async function streamCoachReply(
  env: Env,
  digest: string,
  turns: CoachTurn[],
): Promise<ReadableStream<Uint8Array>> {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });

  const stream = (await client.messages.create({
    model: "claude-opus-5",
    max_tokens: 16000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    stream: true,
    system: [
      { type: "text", text: SYSTEM_INSTRUCTIONS },
      { type: "text", text: digest, cache_control: { type: "ephemeral" } },
    ],
    messages: turns.map((t) => ({ role: t.role, content: t.content })),
  })) as unknown as AsyncIterable<{
    type: string;
    delta?: { type: string; text?: string };
  }>;

  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const text = event.delta.text ?? "";
            if (text) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
            }
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("coach stream failed", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "stream failed" })}\n\n`),
        );
      } finally {
        controller.close();
      }
    },
  });
}
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm exec vitest run worker/coach/chat.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: add the Anthropic streaming coach call"
```

---

### Task 3: The `/api/coach` endpoint

**Files:**
- Create: `worker/routes/coach.ts`
- Modify: `worker/routes/api.ts`
- Test: `worker/routes/coach.test.ts`

**Interfaces:**
- Consumes: `requireSession`, `loadDigest`, `streamCoachReply`.
- Produces: `POST /api/coach` — body `{ turns: CoachTurn[], today: string }`, SSE response.

- [ ] **Step 1: Write the failing test**

`worker/routes/coach.test.ts`:

```ts
import { env, SELF } from "cloudflare:test";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { signSession } from "../session";

const streamCoachReply = vi.fn();
vi.mock("../coach/chat", () => ({
  streamCoachReply: (...args: unknown[]) => streamCoachReply(...args),
}));

beforeEach(() => {
  streamCoachReply.mockReset();
  streamCoachReply.mockResolvedValue(
    new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode('data: {"text":"ok"}\n\n'));
        c.close();
      },
    }),
  );
});

async function post(body: unknown, withSession = true): Promise<Response> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (withSession) headers.Cookie = `sd_session=${await signSession(42, env.SESSION_SECRET)}`;
  return await SELF.fetch("http://example.com/api/coach", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

const valid = { turns: [{ role: "user", content: "How was my week?" }], today: "2026-09-06" };

describe("POST /api/coach", () => {
  it("401s without a session", async () => {
    expect((await post(valid, false)).status).toBe(401);
    expect(streamCoachReply).not.toHaveBeenCalled();
  });

  it("streams a reply as SSE", async () => {
    const res = await post(valid);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    expect(await res.text()).toContain('"text":"ok"');
  });

  it("builds the digest server-side and ignores any digest in the body", async () => {
    await post({ ...valid, digest: "INJECTED" });
    const digestArg = streamCoachReply.mock.calls[0]?.[1] as string;
    expect(digestArg).not.toContain("INJECTED");
    expect(digestArg).toContain("Training summary");
  });

  it("400s an empty turn list", async () => {
    expect((await post({ turns: [], today: "2026-09-06" })).status).toBe(400);
  });

  it("400s when the last turn is not the user's", async () => {
    const res = await post({
      turns: [{ role: "user", content: "hi" }, { role: "assistant", content: "hello" }],
      today: "2026-09-06",
    });
    expect(res.status).toBe(400);
  });

  it("400s a malformed today", async () => {
    expect((await post({ ...valid, today: "not-a-date" })).status).toBe(400);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run worker/routes/coach.test.ts`
Expected: FAIL — 404 on `/api/coach`.

- [ ] **Step 3: Write `worker/routes/coach.ts`**

```ts
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
```

- [ ] **Step 4: Mount it in `worker/routes/api.ts`**

Mount under the existing `api.use("*", requireSession)` so the guard applies:

```ts
import coach from "./coach";
// after the other routes:
api.route("/coach", coach);
```

- [ ] **Step 5: Run it to verify it passes**

Run: `pnpm exec vitest run worker/routes/coach.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add the /api/coach streaming endpoint"
```

---

### Task 4: The Coach screen

**Files:**
- Create: `src/hooks/useCoachStream.ts`, `src/routes/coach.tsx`
- Modify: `src/router.tsx`, `src/components/Shell.tsx`
- Test: `src/hooks/useCoachStream.test.ts`

**Interfaces:**
- Consumes: `todayLocalDate` (Plan 2, Task 5).
- Produces:
  - `useCoachStream(): { turns, ask, streaming, error }`
  - the `/coach` route

- [ ] **Step 1: Write the failing test**

`src/hooks/useCoachStream.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import { createElement } from "react";
import { useCoachStream } from "./useCoachStream";

afterEach(() => vi.unstubAllGlobals());

function sseResponse(chunks: string[]): Response {
  const stream = new ReadableStream({
    start(c) {
      for (const ch of chunks) c.enqueue(new TextEncoder().encode(ch));
      c.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "text/event-stream" } });
}

let api: ReturnType<typeof useCoachStream>;
function Probe() {
  api = useCoachStream();
  return null;
}

describe("useCoachStream", () => {
  it("accumulates text deltas into one assistant turn", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      sseResponse(['data: {"text":"You ran "}\n\n', 'data: {"text":"32 km."}\n\n', "data: [DONE]\n\n"]),
    ));

    render(createElement(Probe));
    await api.ask("How was my week?", "2026-09-06");

    expect(api.turns).toHaveLength(2);
    expect(api.turns[0]).toMatchObject({ role: "user", content: "How was my week?" });
    expect(api.turns[1]).toMatchObject({ role: "assistant", content: "You ran 32 km." });
  });

  it("surfaces a transport failure without losing the question", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    render(createElement(Probe));
    await api.ask("hi", "2026-09-06");

    expect(api.error).toBeTruthy();
    expect(api.turns[0]).toMatchObject({ role: "user", content: "hi" });
  });

  it("ignores an empty question", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    render(createElement(Probe));
    await api.ask("   ", "2026-09-06");
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm exec vitest run --project browser src/hooks/useCoachStream.test.ts`
Expected: FAIL — module `./useCoachStream` not found.

- [ ] **Step 3: Write `src/hooks/useCoachStream.ts`**

```ts
import { useCallback, useRef, useState } from "react";

export interface CoachTurn {
  role: "user" | "assistant";
  content: string;
}

export function useCoachStream() {
  const [turns, setTurns] = useState<CoachTurn[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnsRef = useRef<CoachTurn[]>([]);

  const ask = useCallback(async (question: string, today: string) => {
    const trimmed = question.trim();
    if (!trimmed) return;

    setError(null);
    const next: CoachTurn[] = [...turnsRef.current, { role: "user", content: trimmed }];
    turnsRef.current = next;
    setTurns(next);
    setStreaming(true);

    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns: next, today }),
      });
      if (!res.ok || !res.body) throw new Error(`coach failed: ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let answer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;

          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string };
            if (parsed.error) throw new Error(parsed.error);
            if (parsed.text) {
              answer += parsed.text;
              const withAnswer: CoachTurn[] = [...next, { role: "assistant", content: answer }];
              turnsRef.current = withAnswer;
              setTurns(withAnswer);
            }
          } catch {
            // A frame we cannot parse is skipped; the stream continues.
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The coach is unavailable.");
    } finally {
      setStreaming(false);
    }
  }, []);

  return { turns, ask, streaming, error };
}
```

- [ ] **Step 4: Write `src/routes/coach.tsx`**

```tsx
import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { Route as rootRoute } from "./__root";
import { useCoachStream } from "@/hooks/useCoachStream";
import { todayLocalDate } from "@/lib/format";

const SUGGESTIONS = [
  "How was my week?",
  "Am I training too much?",
  "What should I do today?",
];

function Coach() {
  const { turns, ask, streaming, error } = useCoachStream();
  const [draft, setDraft] = useState("");

  async function submit(question: string) {
    setDraft("");
    await ask(question, todayLocalDate());
  }

  return (
    <div className="flex h-screen flex-col p-10">
      <h1 className="font-display text-[27px] font-bold">Coach</h1>
      <p className="mt-1 text-sm text-muted">Insights drawn from your last 30 days</p>

      <div className="mt-6 flex-1 overflow-y-auto">
        {turns.length === 0 ? (
          <div className="flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void submit(s)}
                className="rounded-[10px] border border-line bg-card px-3 py-2 text-xs font-semibold text-muted hover:bg-raised"
              >
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex max-w-2xl flex-col gap-4">
            {turns.map((t, i) => (
              <div
                key={i}
                className={
                  t.role === "user"
                    ? "self-end rounded-[14px] bg-raised px-4 py-2.5 text-sm"
                    : "rounded-[14px] border border-line bg-card px-4 py-3 text-sm whitespace-pre-wrap"
                }
              >
                {t.content}
              </div>
            ))}
            {streaming ? <p className="text-xs text-faint">Thinking…</p> : null}
          </div>
        )}

        {error ? <p className="mt-4 text-xs text-strength">{error}</p> : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(draft);
        }}
        className="mt-4 flex max-w-2xl gap-2"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={streaming}
          placeholder="Ask about your training…"
          aria-label="Ask about your training"
          className="flex-1 rounded-[12px] border border-line bg-card px-4 py-3 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="rounded-[12px] bg-accent px-5 py-3 text-sm font-bold text-ground disabled:opacity-40"
        >
          Ask
        </button>
      </form>
    </div>
  );
}

export const Route = createRoute({
  getParentRoute: () => rootRoute,
  path: "/coach",
  component: Coach,
});
```

- [ ] **Step 5: Register the route and add it to the nav**

In `src/router.tsx`:

```tsx
import { Route as coachRoute } from "./routes/coach";
const routeTree = rootRoute.addChildren([
  indexRoute, activitiesRoute, progressRoute, activityRoute, coachRoute,
]);
```

In `src/components/Shell.tsx`, add to `NAV`:

```tsx
  { key: "coach", label: "Coach", to: "/coach" },
```

and in `src/routes/__root.tsx`, extend the `activeKey` derivation:

```tsx
    path.startsWith("/coach") ? "coach" :
```

- [ ] **Step 6: Run it to verify it passes**

Run: `pnpm exec vitest run --project browser src/hooks/useCoachStream.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Verify against the real API once**

This is the only step in any plan that spends money — a handful of cents.

Run `pnpm dev`, open `/coach`, ask "How was my week?". Confirm the reply streams
in progressively rather than appearing at once, and that it cites real numbers
from your history.

Then ask a follow-up in the same conversation and check the Worker log for
`cache_read_input_tokens`. If it is zero on the second turn, the digest is not
stable — re-run `worker/coach/digest.test.ts` and look for anything varying.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add the Coach screen"
```

---

### Task 5: Deployment, secrets, and the README

**Files:**
- Modify: `README.md`, `wrangler.jsonc`
- Create: `.dev.vars.example`

**Interfaces:**
- Consumes: everything.
- Produces: a README describing the stack that actually exists.

- [ ] **Step 1: Write `.dev.vars.example`**

```bash
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_VERIFY_TOKEN=
SESSION_SECRET=
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VAPID_SUBJECT=mailto:you@example.com
ANTHROPIC_API_KEY=
```

- [ ] **Step 2: Rewrite `README.md`**

The current README describes code that was removed. Replace it, keeping its
structure but making every claim true of the shipped app:

- **Stack table** — copy from the spec's §2, which is now accurate.
- **How live updates work** — keep the existing ASCII diagram; it is correct.
- **Setup** — Strava app, `.dev.vars`, `pnpm exec wrangler d1 create stravadash`, `pnpm db:migrate:local`, `pnpm dev`.
- **Webhooks in development** — `cloudflared tunnel --url http://localhost:5173`, then `pnpm webhook create https://<tunnel-host>/webhook`. Note the one-subscription-per-application limit.
- **Deploy** — the secret list from `.dev.vars.example` via `wrangler secret put`, `APP_URL` and `ALLOWED_ATHLETE_ID` in `wrangler.jsonc`, `pnpm db:migrate:remote`, `pnpm deploy`.
- **Commands table** — `dev`, `build`, `test`, `test:e2e`, `typecheck`, `webhook`, `deploy`.
- **Layout** — `worker/`, `shared/`, `src/`, `migrations/`, `scripts/`, `e2e/`, `docs/superpowers/`.
- **Costs** — state plainly that everything runs inside Cloudflare's free tier except the Coach, which calls the Anthropic API per question.
- **Status** — replace the "gamification is intentionally not built" paragraph with what is now true: the pipeline, dashboard and Coach ship; the gamification layer (levels, badges, goals) and the Strength screen with muscle-group tagging remain deferred, with a pointer to the spec's §13.

- [ ] **Step 3: Set production secrets**

```bash
for s in STRAVA_CLIENT_ID STRAVA_CLIENT_SECRET STRAVA_VERIFY_TOKEN SESSION_SECRET \
         VAPID_PUBLIC_KEY VAPID_PRIVATE_KEY VAPID_SUBJECT ANTHROPIC_API_KEY; do
  pnpm exec wrangler secret put "$s"
done
```

Set `APP_URL` to the deployed origin and `ALLOWED_ATHLETE_ID` to your Strava
athlete id in `wrangler.jsonc` before deploying. Left empty, the first athlete
to complete OAuth claims the instance.

- [ ] **Step 4: Deploy and re-point the webhook**

```bash
pnpm db:migrate:remote
pnpm deploy
pnpm webhook list          # delete the tunnel subscription if one exists
pnpm webhook create https://<your-worker-host>/webhook
```

- [ ] **Step 5: Full verification**

Run: `pnpm test && pnpm typecheck && pnpm test:e2e`
Expected: all green.

Then on the deployed origin: connect, wait for the backfill, install the PWA,
upload an activity, and confirm it appears without a refresh.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs: rewrite README for the shipped stack"
```

---

## Spec coverage

| Spec section | Where |
|---|---|
| §4.6 Coach — digest built server-side | Task 1, enforced by a test in Task 3 |
| §4.6 — determinism for prompt caching | Task 1, three dedicated tests |
| §4.6 — `claude-opus-5`, adaptive thinking, no `budget_tokens` | Task 2, asserted in tests |
| §4.6 — effort `medium`, streaming, `max_tokens` 16000 | Task 2 |
| §4.6 — cached system prefix, varying question after | Task 2, asserted in tests |
| §4.6 — no prefill | Task 2 and Task 3 (`parseTurns` rejects a trailing assistant turn) |
| §4.6 — no tool use | Task 2 — no `tools` parameter exists |
| §4.6 — session-guarded, single outbound key | Task 3 |
| §6 `POST /api/coach` | Task 3 |
| §8 Coach call fails | Task 2 (stream error frame) and Task 4 (`error` surfaced, conversation kept) |
| §10 `ANTHROPIC_API_KEY` secret | Tasks 2 and 5 |
| §11 Coach is the only paid dependency | Task 5, stated in the README |
| §11 `README.md` rewrite | Task 5 |

## Definition of done

- `pnpm test`, `pnpm typecheck` and `pnpm test:e2e` all green.
- No test calls the real Anthropic API; the single live check is Task 4, Step 7.
- `cache_read_input_tokens` is non-zero on the second turn of a conversation.
- The digest test suite fails if anyone introduces a timestamp into it.
- `README.md` describes only things that exist in the tree.
