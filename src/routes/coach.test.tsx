import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Coach } from "./coach";
import { queryKeys } from "@/lib/queries";
import type { CoachKeyStatus } from "@/lib/queries";

function mount(keyStatus: CoachKeyStatus) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.coachKey, keyStatus);
  return render(
    <QueryClientProvider client={client}>
      <Coach />
    </QueryClientProvider>,
  );
}

describe("Coach", () => {
  it("shows the BYOK setup form when no key is configured", async () => {
    await mount({ hasKey: false, source: "none" });
    await expect.element(page.getByLabelText("Anthropic API key")).toBeInTheDocument();
    await expect.element(page.getByPlaceholder("Ask about your training…")).not.toBeInTheDocument();
  });

  it("shows the chat once a key is configured", async () => {
    await mount({ hasKey: true, source: "env" });
    await expect.element(page.getByPlaceholder("Ask about your training…")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Remove API key" })).not.toBeInTheDocument();
  });

  it("offers to remove the key only when it's a BYOK key, not the env fallback", async () => {
    await mount({ hasKey: true, source: "byok" });
    await expect.element(page.getByRole("button", { name: "Remove API key" })).toBeInTheDocument();
  });
});
