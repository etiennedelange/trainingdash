import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Progress } from "./progress";
import type { ActivitySummary } from "#shared/types";

const row = (id: number, local_date: string, sport_type: string): ActivitySummary => ({
  id, name: `A${id}`, sport_type,
  start_date: `${local_date}T10:00:00Z`, local_date,
  elapsed_time: 1800, moving_time: 1800, distance: 5000,
  total_elevation_gain: 0, average_speed: 2.78, average_heartrate: 140,
  suffer_score: 10, updated_at: 1,
});

function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return render(
    <QueryClientProvider client={client}>
      <Progress today="2026-09-06" />
    </QueryClientProvider>,
  );
}

describe("Progress", () => {
  it("renders a mix row per sport with its percentage", async () => {
    await mount([
      row(1, "2026-09-01", "Run"),
      row(2, "2026-09-02", "Run"),
      row(3, "2026-09-03", "Ride"),
      row(4, "2026-09-04", "Walk"),
    ]);
    await expect.element(page.getByText("Run")).toBeInTheDocument();
    await expect.element(page.getByText("50%")).toBeInTheDocument();
  });

  it("shows an empty state with no data", async () => {
    await mount([]);
    await expect.element(page.getByText(/nothing to compare yet/i)).toBeInTheDocument();
  });
});
