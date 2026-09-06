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
