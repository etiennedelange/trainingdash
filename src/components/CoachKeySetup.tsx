import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/queries";

/**
 * Gates Coach behind the athlete's own Anthropic API key (BYOK) — this app
 * has no shared/free LLM backend, so Coach stays off until a key is set,
 * either here or as the deploy-time ANTHROPIC_API_KEY secret.
 */
const KEY_PATTERN = /^sk-ant-/;

export function CoachKeySetup() {
  const queryClient = useQueryClient();
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = value.trim();
  const formatInvalid = touched && trimmed.length > 0 && !KEY_PATTERN.test(trimmed);

  const saveKey = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!KEY_PATTERN.test(apiKey)) throw new Error("That didn't look like a valid Anthropic API key.");
      const res = await fetch("/api/coach/key", {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      if (!res.ok) throw new Error("That didn't look like a valid Anthropic API key.");
    },
    onSuccess: async () => {
      setValue("");
      setTouched(false);
      await queryClient.invalidateQueries({ queryKey: queryKeys.coachKey });
    },
  });

  return (
    <div className="max-w-md">
      <p className="text-sm text-muted">
        Coach runs on your own Anthropic API key — nothing shared, nothing metered by this app.
        Paste it below; it's stored encrypted and used only server-side to answer your questions.
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          setTouched(true);
          saveKey.mutate(trimmed);
        }}
        className="mt-4 flex flex-col gap-2"
      >
        <input
          type="password"
          autoComplete="new-password"
          required
          pattern="sk-ant-.*"
          title="Anthropic API keys start with sk-ant-"
          disabled={saveKey.isPending}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            if (saveKey.isError) saveKey.reset();
          }}
          onBlur={() => setTouched(true)}
          placeholder="sk-ant-…"
          aria-label="Anthropic API key"
          aria-invalid={formatInvalid || saveKey.isError ? true : undefined}
          aria-describedby={saveKey.isError ? "coach-key-error" : undefined}
          className="rounded-[var(--radius-control)] border border-line bg-card px-3 py-2.5 text-sm outline-none focus:border-accent aria-[invalid=true]:border-danger disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={saveKey.isPending || !value.trim()}
          aria-busy={saveKey.isPending}
          className="self-start rounded-[var(--radius-control)] bg-accent px-5 py-2 text-sm font-bold text-on-accent disabled:opacity-40"
        >
          {saveKey.isPending ? "Saving…" : "Save key"}
        </button>
        {saveKey.isError ? (
          <p id="coach-key-error" role="alert" className="text-xs text-danger">
            That didn't look like a valid Anthropic API key.
          </p>
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
