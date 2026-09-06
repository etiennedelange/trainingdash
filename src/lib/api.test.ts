import { describe, it, expect, vi, afterEach } from "vitest";
import { apiGet, ApiError } from "./api";

afterEach(() => vi.unstubAllGlobals());

function stubFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
}

describe("apiGet", () => {
  it("returns the parsed body on 200", async () => {
    stubFetch(200, { ok: true });
    expect(await apiGet<{ ok: boolean }>("/api/health")).toEqual({ ok: true });
  });

  it("throws ApiError carrying the status on failure", async () => {
    stubFetch(401, { error: "unauthorized" });
    await expect(apiGet("/api/me")).rejects.toBeInstanceOf(ApiError);
    await expect(apiGet("/api/me")).rejects.toMatchObject({ status: 401 });
  });

  it("sends credentials so the session cookie rides along", async () => {
    stubFetch(200, {});
    await apiGet("/api/me");
    expect(fetch).toHaveBeenCalledWith("/api/me", expect.objectContaining({
      credentials: "same-origin",
    }));
  });
});
