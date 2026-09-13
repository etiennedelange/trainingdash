import Anthropic from "@anthropic-ai/sdk";
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
  apiKey: string,
  digest: string,
  turns: CoachTurn[],
): Promise<ReadableStream<Uint8Array>> {
  const client = new Anthropic({ apiKey });

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
