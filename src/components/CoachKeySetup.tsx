import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";

/**
 * Gates Coach behind the athlete's own Anthropic API key (BYOK) — this app
 * has no shared/free LLM backend, so Coach stays off until a key is set,
 * either here or as the deploy-time ANTHROPIC_API_KEY secret.
 */
export function CoachKeySetup() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "error">("idle");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    const res = await fetch("/api/coach/key", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: value.trim() }),
    });
    if (!res.ok) {
      setState("error");
      return;
    }
    setValue("");
    await queryClient.invalidateQueries({ queryKey: queryKeys.coachKey });
  }

  return (
    <div className="max-w-md">
      <p className="text-sm text-muted">
        Coach runs on your own Anthropic API key — nothing shared, nothing metered by this app.
        Paste it below; it's stored encrypted and used only server-side to answer your questions.
      </p>

      <form onSubmit={(e) => void save(e)} className="mt-4 flex flex-col gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (state === "error") setState("idle");
          }}
          placeholder="sk-ant-…"
          aria-label="Anthropic API key"
          className="rounded-[var(--radius-control)] border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={state === "saving" || !value.trim()}
          className="self-start rounded-[var(--radius-control)] bg-accent px-5 py-2 text-sm font-bold text-on-accent disabled:opacity-40"
        >
          {state === "saving" ? "Saving…" : "Save key"}
        </button>
        {state === "error" ? (
          <p className="text-xs text-danger">That didn't look like a valid Anthropic API key.</p>
        ) : null}
      </form>

      <a
        href="https://console.anthropic.com/settings/keys"
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-block text-xs font-semibold text-muted hover:text-text"
      >
        Get an API key from console.anthropic.com →
      </a>
    </div>
  );
}
