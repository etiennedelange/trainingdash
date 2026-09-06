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
                className="rounded-[var(--radius-control)] border border-line bg-card px-3 py-2 text-xs font-semibold text-muted shadow-[var(--shadow-surface)] hover:bg-raised"
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
                    ? "self-end rounded-[var(--radius-row)] bg-raised px-4 py-2.5 text-sm"
                    : "rounded-[var(--radius-row)] border border-line bg-card px-4 py-3 text-sm whitespace-pre-wrap shadow-[var(--shadow-surface)]"
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
          className="flex-1 rounded-[var(--radius-tile)] border border-line bg-card px-4 py-3 text-sm shadow-[var(--shadow-surface)] outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="rounded-[var(--radius-control)] bg-accent px-5 py-3 text-sm font-bold text-on-accent disabled:opacity-40"
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
