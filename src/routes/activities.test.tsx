import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { Activities } from "./activities";
import type { ActivitySummary } from "#shared/types";

const testRouter = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const row = (id: number, local_date: string): ActivitySummary => ({
  id, name: `Run ${id}`, sport_type: "Run",
  start_date: `${local_date}T10:00:00Z`, local_date,
  elapsed_time: 1800, moving_time: 1800, distance: 5000,
  total_elevation_gain: 0, average_speed: 2.78, average_heartrate: 140,
  suffer_score: 10, updated_at: 1,
});

function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return render(
    <RouterContextProvider router={testRouter}>
      <QueryClientProvider client={client}>
        <Activities today="2026-09-06" />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

describe("Activities", () => {
  it("defaults to the timeline tab", async () => {
    await mount([row(1, "2026-09-06")]);
    await expect.element(page.getByText("Run 1")).toBeInTheDocument();
  });

  it("switches to the calendar tab", async () => {
    await mount([row(1, "2026-09-06")]);
    await page.getByRole("tab", { name: "Calendar" }).click();
    await expect.element(page.getByTestId("calendar")).toBeInTheDocument();
  });

  it("counts distinct active days, not activities", async () => {
    await mount([row(1, "2026-09-06"), row(2, "2026-09-06"), row(3, "2026-09-05")]);
    await expect.element(page.getByTestId("active-days")).toHaveTextContent("2");
  });
});
