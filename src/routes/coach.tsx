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
    <div className="flex h-full min-h-0 flex-col p-10">
      <h1 className="font-display text-[27px] font-bold">Coach</h1>
      <p className="mt-1 text-sm text-muted">Insights drawn from your last 30 days</p>

      <div className="mt-6 flex-1 overflow-y-auto">
        {turns.length === 0 ? (
          <div className="flex max-w-2xl flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void submit(s)}
                className="rounded-[var(--radius-control)] px-2 py-1.5 text-left font-mono text-xs text-muted hover:bg-raised hover:text-text"
              >
                <span className="text-accent">&gt; </span>
                {s}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex max-w-2xl flex-col divide-y divide-line border-t border-line">
            {turns.map((t, i) => (
              <div key={i} className="flex gap-3 py-4">
                <span
                  aria-hidden="true"
                  className="mt-0.5 flex-none font-mono text-xs font-bold text-accent select-none"
                >
                  {t.role === "user" ? ">" : "·"}
                </span>
                <p className="text-sm whitespace-pre-wrap text-text">{t.content}</p>
              </div>
            ))}
            {streaming ? (
              <div className="flex gap-3 py-4">
                <span aria-hidden="true" className="mt-0.5 flex-none font-mono text-xs font-bold text-accent">
                  ·
                </span>
                <p className="font-mono text-xs text-faint">thinking…</p>
              </div>
            ) : null}
          </div>
        )}

        {error ? <p className="mt-4 font-mono text-xs text-danger">! {error}</p> : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(draft);
        }}
        className="mt-4 flex max-w-2xl items-center gap-2 rounded-[var(--radius-tile)] border border-line bg-card px-4 shadow-[var(--shadow-surface)] focus-within:border-accent"
      >
        <span aria-hidden="true" className="flex-none font-mono text-sm font-bold text-accent">
          &gt;
        </span>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          disabled={streaming}
          placeholder="Ask about your training…"
          aria-label="Ask about your training"
          className="flex-1 bg-transparent py-3 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={streaming || !draft.trim()}
          className="rounded-[var(--radius-control)] bg-accent px-5 py-2 text-sm font-bold text-on-accent disabled:opacity-40"
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
