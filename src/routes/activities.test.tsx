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

const row = (id: number, local_date: string, sport_type = "Run"): ActivitySummary => ({
  id, name: `${sport_type} ${id}`, sport_type,
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

  it("navigates the tablist with the keyboard (arrows, Home, End)", async () => {
    await mount([row(1, "2026-09-06")]);
    const timeline = page.getByRole("tab", { name: "Timeline" });
    const calendar = page.getByRole("tab", { name: "Calendar" });
    const press = async (key: string) => {
      const el = await timeline.element();
      el.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    };
    await timeline.click();

    await press("ArrowRight");
    await expect.element(calendar).toHaveFocus();
    await expect.element(page.getByTestId("calendar")).toBeInTheDocument();

    await press("ArrowLeft");
    await expect.element(timeline).toHaveFocus();

    await press("End");
    await expect.element(calendar).toHaveFocus();

    await press("Home");
    await expect.element(timeline).toHaveFocus();
  });

  it("counts distinct active days, not activities", async () => {
    await mount([row(1, "2026-09-06"), row(2, "2026-09-06"), row(3, "2026-09-05")]);
    await expect.element(page.getByTestId("active-days")).toHaveTextContent("2");
  });

  it("filters the timeline to one sport", async () => {
    await mount([row(1, "2026-09-06", "Run"), row(2, "2026-09-06", "Ride")]);
    await page.getByRole("button", { name: "Ride" }).click();
    await expect.element(page.getByText("Ride 2")).toBeInTheDocument();
    await expect.element(page.getByText("Run 1")).not.toBeInTheDocument();
  });

  it("offers to clear a filter that matches nothing, and restores the list", async () => {
    await mount([row(1, "2026-09-06", "Run")]);
    await page.getByRole("button", { name: "Walk" }).click();
    await expect.element(page.getByText(/no activities match your filters/i)).toBeInTheDocument();

    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect.element(page.getByText("Run 1")).toBeInTheDocument();
  });

  it("searches the timeline by activity name", async () => {
    await mount([row(1, "2026-09-06", "Run"), row(2, "2026-09-06", "Ride")]);
    await page.getByRole("searchbox", { name: "Search activities" }).fill("ride");
    await expect.element(page.getByText("Ride 2")).toBeInTheDocument();
    await expect.element(page.getByText("Run 1")).not.toBeInTheDocument();
  });

  it("filters the timeline to a date range", async () => {
    await mount([
      row(1, "2026-09-01", "Run"),
      row(2, "2026-09-06", "Run"),
      row(3, "2026-08-20", "Run"),
    ]);
    await page.getByTestId("from-date").fill("2026-09-01");
    await page.getByTestId("to-date").fill("2026-09-06");
    await expect.element(page.getByText("Run 1")).toBeInTheDocument();
    await expect.element(page.getByText("Run 2")).toBeInTheDocument();
    await expect.element(page.getByText("Run 3")).not.toBeInTheDocument();
  });

  it("combines a name search with a sport filter", async () => {
    await mount([
      row(1, "2026-09-06", "Run"),
      row(2, "2026-09-06", "Ride"),
    ]);
    await page.getByRole("button", { name: "Ride" }).click();
    await page.getByRole("searchbox", { name: "Search activities" }).fill("nonexistent");
    await expect.element(page.getByText(/no activities match your filters/i)).toBeInTheDocument();
    await expect.element(page.getByText("Ride 2")).not.toBeInTheDocument();
  });

  it("keeps the active-days stat as a lifetime total when a filter is applied", async () => {
    await mount([row(1, "2026-09-06", "Run"), row(2, "2026-09-05", "Ride")]);
    await page.getByRole("button", { name: "Ride" }).click();
    await expect.element(page.getByTestId("active-days")).toHaveTextContent("2");
  });
});
