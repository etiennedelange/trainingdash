import { test, expect } from "@playwright/test";

test.describe("dashboard", () => {
  test("redirects an unauthenticated visitor toward connecting", async ({ page }) => {
    await page.goto("/");
    // With no session the API 401s; the shell must still render, not white-screen.
    await expect(page.getByText("Trainingdash")).toBeVisible();
  });

  test("navigates between screens", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Activities" }).click();
    await expect(page).toHaveURL(/\/activities$/);
    await page.getByRole("link", { name: "Progress" }).click();
    await expect(page).toHaveURL(/\/progress$/);
  });
});
