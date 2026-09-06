import { test, expect } from "@playwright/test";

test("an incoming webhook event updates the page without a reload", async ({ page, request }) => {
  await page.goto("/");

  const reloaded = page.evaluate(() => {
    (window as unknown as { __stayed: boolean }).__stayed = true;
  });
  await reloaded;

  // The token is a PATH segment, not a query param — posting to bare
  // /webhook matches no route. See "What Plan 1 discovered".
  const token = process.env.STRAVA_VERIFY_TOKEN;
  test.skip(!token, "STRAVA_VERIFY_TOKEN must be set to exercise the webhook");

  await request.post(`/webhook/${encodeURIComponent(token!)}`, {
    data: {
      object_type: "activity",
      object_id: 999_999_999,
      aspect_type: "create",
      owner_id: Number(process.env.E2E_ATHLETE_ID ?? 0),
      subscription_id: 1,
      event_time: Math.floor(Date.now() / 1000),
      updates: {},
    },
  });

  // The page must not have navigated — the update arrives over the socket.
  await expect
    .poll(() => page.evaluate(() => (window as unknown as { __stayed?: boolean }).__stayed))
    .toBe(true);
});
