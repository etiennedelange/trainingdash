import { env } from "cloudflare:test";
import { describe, it, expect, beforeEach } from "vitest";
import { getBackfillState, setBackfillState } from "./sync";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM sync_state").run();
});

describe("sync state", () => {
  it("defaults to page 1, incomplete", async () => {
    expect(await getBackfillState(env.DB)).toEqual({ page: 1, complete: false, last_error: null });
  });

  it("round-trips", async () => {
    await setBackfillState(env.DB, { page: 4, complete: false, last_error: "rate limited" });
    expect(await getBackfillState(env.DB)).toEqual({ page: 4, complete: false, last_error: "rate limited" });
  });
});
