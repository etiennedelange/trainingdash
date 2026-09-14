import { useState } from "react";
import { createRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Route as rootRoute } from "./__root";
import { useCoachStream } from "@/hooks/useCoachStream";
import { CoachKeySetup } from "@/components/CoachKeySetup";
import { LoadingState } from "@/components/LoadingState";
import { coachKeyQuery, queryKeys } from "@/lib/queries";
import { todayLocalDate } from "@/lib/format";

const SUGGESTIONS = [
  "How was my week?",
  "Am I training too much?",
  "What should I do today?",
];

export function Coach() {
  const { turns, ask, isPending, error } = useCoachStream();
  const [draft, setDraft] = useState("");
  const queryClient = useQueryClient();
  const { data: keyStatus, isPending: keyPending } = useQuery(coachKeyQuery);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  async function submit(question: string) {
    setDraft("");
    await ask(question, todayLocalDate());
  }

  async function removeKey() {
    setConfirmingRemove(false);
    await fetch("/api/coach/key", { method: "DELETE", credentials: "same-origin" });
    await queryClient.invalidateQueries({ queryKey: queryKeys.coachKey });
  }

  if (keyPending) return <LoadingState />;

  if (!keyStatus?.hasKey) {
    return (
      <div className="p-10">
        <h1 className="font-display text-[27px] font-bold">Coach</h1>
        <div className="mt-6">
          <CoachKeySetup />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col p-10">
      <div className="flex items-baseline justify-between">
        <h1 className="font-display text-[27px] font-bold">Coach</h1>
        {keyStatus.source === "byok" ? (
          confirmingRemove ? (
            <div className="flex items-center gap-2 text-xs font-semibold">
              <span className="text-muted">Remove your saved key?</span>
              <button onClick={() => void removeKey()} className="text-danger hover:underline">
                Confirm
              </button>
              <button onClick={() => setConfirmingRemove(false)} className="text-muted hover:text-text">
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingRemove(true)}
              className="text-xs font-semibold text-muted hover:text-text"
            >
              Remove API key
            </button>
          )
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">Insights drawn from your last 30 days</p>

      <div className="mt-6 flex-1 overflow-y-auto">
        {turns.length === 0 ? (
          <div className="flex max-w-2xl flex-col gap-1.5">
            <p className="text-sm text-muted">Nothing here yet — ask about your training or pick a prompt.</p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => void submit(s)}
                disabled={isPending}
                className="rounded-[var(--radius-control)] px-2 py-1.5 text-left font-mono text-xs text-muted hover:bg-raised hover:text-text disabled:opacity-40"
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
            {isPending ? (
              <div className="flex gap-3 py-4">
                <span aria-hidden="true" className="mt-0.5 flex-none font-mono text-xs font-bold text-accent">
                  ·
                </span>
                <p className="font-mono text-xs text-faint">thinking…</p>
              </div>
            ) : null}
          </div>
        )}

        {error ? (
          <p role="alert" className="mt-4 font-mono text-xs text-danger">
            ! {error}
          </p>
        ) : null}
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
          disabled={isPending}
          required
          minLength={1}
          placeholder="Ask about your training…"
          aria-label="Ask about your training"
          className="flex-1 bg-transparent py-3 text-sm outline-none focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-1"
        />
        <button
          type="submit"
          disabled={isPending || !draft.trim()}
          aria-busy={isPending}
          className="rounded-[var(--radius-control)] bg-accent px-5 py-2 text-sm font-bold text-on-accent disabled:opacity-40"
        >
          {isPending ? "Asking…" : "Ask"}
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
