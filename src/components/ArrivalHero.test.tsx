import { describe, it, expect, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterContextProvider,
} from "@tanstack/react-router";
import { ArrivalHero, type ArrivalHeroContext } from "./ArrivalHero";
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

const context: ArrivalHeroContext = {
  week: { count: 3, distance: 45000, movingTime: 9000, elevation: 300 },
  prevWeek: { count: 2, distance: 30000, movingTime: 6000, elevation: 200 },
  distanceDeltaPct: 150,
  isBestWeek: true,
  streak: 4,
};

function mount(context?: ArrivalHeroContext, onDismiss = vi.fn()) {
  return {
    onDismiss,
    ...render(
      <RouterContextProvider router={testRouter}>
        <ArrivalHero activity={activity} context={context} onDismiss={onDismiss} />
      </RouterContextProvider>,
    ),
  };
}

describe("ArrivalHero", () => {
  it("shows the activity's name and stats", async () => {
    mount();
    await expect.element(page.getByText("Morning Ride")).toBeInTheDocument();
    await expect.element(page.getByText(/just arrived/i)).toBeInTheDocument();
    await expect.element(page.getByText("25.00")).toBeInTheDocument();
  });

  it("calls onDismiss when the dismiss button is clicked", async () => {
    const { onDismiss } = mount();
    await page.getByRole("button", { name: "Dismiss" }).click();
    expect(onDismiss).toHaveBeenCalled();
  });

  it("shows the week frame, delta, and streak when given context", async () => {
    mount(context);
    await expect.element(page.getByText("45.00")).toBeInTheDocument();
    await expect.element(page.getByText(/3 activities/i)).toBeInTheDocument();
    await expect.element(page.getByText("▲ 50%")).toBeInTheDocument();
    await expect.element(page.getByText("4 days")).toBeInTheDocument();
    await expect.element(page.getByText(/best week yet/i)).toBeInTheDocument();
  });

  it("hides the delta when there is no prior week", async () => {
    mount({ ...context, distanceDeltaPct: null, isBestWeek: false });
    await expect.element(page.getByText(/no prior week/i)).toBeInTheDocument();
    await expect.element(page.getByText(/best week yet/i)).not.toBeInTheDocument();
  });

  it("shows a tag for each personal record the arrival sets", async () => {
    mount({ ...context, newRecords: ["Longest run", "Fastest run"] });
    await expect.element(page.getByText(/new record · longest run/i)).toBeInTheDocument();
    await expect.element(page.getByText(/new record · fastest run/i)).toBeInTheDocument();
  });
});
