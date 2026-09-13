import { describe, it, expect } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  createRoute,
  RouterContextProvider,
} from "@tanstack/react-router";
import { CommandPalette } from "./CommandPalette";
import type { ActivitySummary } from "#shared/types";

const root = createRootRoute();
const testRouter = createRouter({
  routeTree: root.addChildren([
    createRoute({ getParentRoute: () => root, path: "/", component: () => null }),
    createRoute({ getParentRoute: () => root, path: "/activity/$id", component: () => null }),
  ]),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

const activity: ActivitySummary = {
  id: 7, name: "Morning Ride", sport_type: "Ride",
  start_date: "2026-09-06T07:00:00Z", local_date: "2026-09-06",
  elapsed_time: 3600, moving_time: 3500, distance: 25000,
  total_elevation_gain: 120, average_speed: 7.1, average_heartrate: 138,
  suffer_score: 50, updated_at: 1,
};

async function mount(data: ActivitySummary[]) {
  const client = new QueryClient();
  client.setQueryData(["activities"], data);
  return await render(
    <RouterContextProvider router={testRouter}>
      <QueryClientProvider client={client}>
        <CommandPalette />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

function openPalette() {
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }));
}

function press(key: string) {
  window.dispatchEvent(new KeyboardEvent("keydown", { key }));
}

describe("CommandPalette", () => {
  it("is hidden until Cmd+K", async () => {
    await mount([activity]);
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens on Cmd+K and lists pages and recent activities", async () => {
    await mount([activity]);
    openPalette();
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    await expect.element(page.getByText("Today")).toBeInTheDocument();
    await expect.element(page.getByText("Morning Ride")).toBeInTheDocument();
  });

  it("filters activities and pages as you type", async () => {
    await mount([activity]);
    openPalette();
    const input = page.getByRole("searchbox", { name: "Search activities and pages" });
    await input.fill("morning");
    await expect.element(page.getByText("Morning Ride")).toBeInTheDocument();
    await expect.element(page.getByText("Today")).not.toBeInTheDocument();
    await input.fill("zzz");
    await expect.element(page.getByText(/no matches/i)).toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    await mount([activity]);
    openPalette();
    await expect.element(page.getByRole("dialog")).toBeInTheDocument();
    press("Escape");
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });

  it("selecting an activity closes the palette", async () => {
    await mount([activity]);
    openPalette();
    await page.getByText("Morning Ride").click();
    await expect.element(page.getByRole("dialog")).not.toBeInTheDocument();
  });
});