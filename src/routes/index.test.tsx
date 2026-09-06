import { describe, it, expect, vi, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { Today } from "./index";
import type { ActivitySummary } from "#shared/types";

const testRouter = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const rows: ActivitySummary[] = [
  {
    id: 1, name: "Evening Run", sport_type: "Run",
    start_date: "2026-09-06T16:41:00Z", local_date: "2026-09-06",
    elapsed_time: 2052, moving_time: 2052, distance: 6420,
    total_elevation_gain: 48, average_speed: 3.13, average_heartrate: 152,
    suffer_score: 40, updated_at: 1,
  },
];

function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return render(
    <RouterContextProvider router={testRouter}>
      <QueryClientProvider client={client}>
        <Today today="2026-09-06" />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

afterEach(() => vi.useRealTimers());

describe("Today", () => {
  it("shows the streak from the activity history", async () => {
    await mount(rows);
    await expect.element(page.getByText(/day streak/i)).toBeInTheDocument();
    await expect.element(page.getByText("1").first()).toBeInTheDocument();
  });

  it("lists recent activities", async () => {
    await mount(rows);
    await expect.element(page.getByText("Evening Run")).toBeInTheDocument();
  });

  it("shows an empty state when nothing has been imported", async () => {
    await mount([]);
    await expect.element(page.getByText(/no activities yet/i)).toBeInTheDocument();
  });
});
