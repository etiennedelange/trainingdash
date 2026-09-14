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
import { AccountStatus } from "./AccountStatus";
import { queryKeys } from "@/lib/queries";

afterEach(() => vi.unstubAllGlobals());

const testRouter = createRouter({
  routeTree: createRootRoute(),
  history: createMemoryHistory({ initialEntries: ["/"] }),
});

function mount(me: unknown) {
  const client = new QueryClient();
  client.setQueryData(queryKeys.me, me);
  return render(
    <RouterContextProvider router={testRouter}>
      <QueryClientProvider client={client}>
        <AccountStatus />
      </QueryClientProvider>
    </RouterContextProvider>,
  );
}

describe("AccountStatus", () => {
  it("shows a quiet empty state when not connected — the main content carries the one Connect CTA", async () => {
    await mount({ athleteId: 1, connected: false, backfill: { page: 0, complete: false, last_error: null }, vapidPublicKey: "x" });
    await expect.element(page.getByText(/no data yet/i)).toBeInTheDocument();
    await expect.element(page.getByRole("link", { name: "Connect Strava" })).not.toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Log out" })).not.toBeInTheDocument();
  });

  it("shows a logout button when connected", async () => {
    await mount({ athleteId: 1, connected: true, backfill: { page: 3, complete: true, last_error: null }, vapidPublicKey: "x" });
    await expect.element(page.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("posts to /auth/logout when clicked", async () => {
    const me = { athleteId: 1, connected: true, backfill: { page: 3, complete: true, last_error: null }, vapidPublicKey: "x" };
    // meQuery has no staleTime, so mounting triggers a background refetch —
    // it must echo the same "connected" shape or the button disappears
    // under the click before the assertion runs.
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/me")
        ? new Response(JSON.stringify(me), { status: 200 })
        : new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await mount(me);
    await page.getByRole("button", { name: "Log out" }).click();

    await expect.poll(() => fetchSpy.mock.calls.length).toBeGreaterThan(0);
    expect(fetchSpy).toHaveBeenCalledWith("/auth/logout", expect.objectContaining({ method: "POST" }));
  });

  it("shows a pending state and disables the button while logging out", async () => {
    const me = { athleteId: 1, connected: true, backfill: { page: 3, complete: true, last_error: null }, vapidPublicKey: "x" };
    let resolveLogout!: () => void;
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).includes("/api/me")) return new Response(JSON.stringify(me), { status: 200 });
      await new Promise<void>((resolve) => (resolveLogout = resolve));
      return new Response(JSON.stringify({ ok: true }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchSpy);

    await mount(me);
    await page.getByRole("button", { name: "Log out" }).click();

    const pendingButton = page.getByRole("button", { name: "Logging out…" });
    await expect.element(pendingButton).toBeInTheDocument();
    await expect.element(pendingButton).toBeDisabled();

    resolveLogout();
  });

  it("shows an inline error when the logout request fails", async () => {
    const me = { athleteId: 1, connected: true, backfill: { page: 3, complete: true, last_error: null }, vapidPublicKey: "x" };
    const fetchSpy = vi.fn(async (input: RequestInfo | URL) =>
      String(input).includes("/api/me")
        ? new Response(JSON.stringify(me), { status: 200 })
        : new Response(null, { status: 500 }),
    );
    vi.stubGlobal("fetch", fetchSpy);

    await mount(me);
    await page.getByRole("button", { name: "Log out" }).click();

    await expect.element(page.getByText("Couldn't log out. Try again.")).toBeInTheDocument();
    await expect.element(page.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });
});
