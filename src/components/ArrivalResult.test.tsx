import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { ArrivalResult } from "./ArrivalResult";
import { HeroArrivalContext } from "@/hooks/useLiveUpdates";
import { queryKeys } from "@/lib/queries";
import type { ActivitySummary } from "#shared/types";

const testRouter = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const activity: ActivitySummary = {
  id: 7, name: "Morning Ride", sport_type: "Ride",
  start_date: "2026-09-06T07:00:00Z", local_date: "2026-09-06",
  elapsed_time: 3600, moving_time: 3500, distance: 25000,
  total_elevation_gain: 120, average_speed: 7.1, average_heartrate: 138,
  suffer_score: 50, updated_at: 1,
};

function mount(
  hero: { activity: ActivitySummary | null; dismiss: () => void },
  data: ActivitySummary[],
) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.activities, data);
  return render(
    <RouterContextProvider router={testRouter}>
      <QueryClientProvider client={client}>
        <HeroArrivalContext.Provider value={hero}>
          <ArrivalResult today="2026-09-06" />
        </HeroArrivalContext.Provider>
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

beforeEach(() => localStorage.clear());

describe("ArrivalResult", () => {
  it("renders the result hero app-wide for a just-arrived activity", async () => {
    mount({ activity, dismiss: vi.fn() }, [activity]);
    await expect.element(page.getByText(/just arrived/i)).toBeInTheDocument();
    await expect.element(page.getByRole("heading", { name: "Morning Ride" })).toBeInTheDocument();
  });

  it("renders nothing when there is no arrival", async () => {
    mount({ activity: null, dismiss: vi.fn() }, []);
    await expect.element(page.getByText(/just arrived/i)).not.toBeInTheDocument();
  });

  it("frames the arrival against a set weekly goal", async () => {
    localStorage.setItem("trainingdash:weekly-goal-km", "50");
    mount({ activity, dismiss: vi.fn() }, [activity]);
    await expect.element(page.getByText(/weekly goal/i)).toBeInTheDocument();
    await expect.element(page.getByText("50%")).toBeInTheDocument();
  });
});