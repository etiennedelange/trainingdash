import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { describe, it, expect } from "vitest";
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { Shell } from "./Shell";

function renderWithRouter(children: React.ReactNode) {
  const rootRoute = createRootRoute({ component: () => children });
  const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: () => null });
  const activitiesRoute = createRoute({ getParentRoute: () => rootRoute, path: "/activities", component: () => null });
  const progressRoute = createRoute({ getParentRoute: () => rootRoute, path: "/progress", component: () => null });
  const routeTree = rootRoute.addChildren([indexRoute, activitiesRoute, progressRoute]);
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: ["/"] }) });
  return render(<RouterProvider router={router} />);
}

describe("Shell", () => {
  it("renders the brand and its children", async () => {
    renderWithRouter(<Shell><p>content</p></Shell>);
    await expect.element(page.getByRole("navigation", { name: "Primary" }).getByText("Trainingdash")).toBeInTheDocument();
    await expect.element(page.getByText("content")).toBeInTheDocument();
  });

  it("marks the active nav item", async () => {
    renderWithRouter(<Shell activeKey="progress"><p>x</p></Shell>);
    const link = page.getByRole("link", { name: "Progress" });
    await expect.element(link).toHaveAttribute("aria-current", "page");
  });
});
