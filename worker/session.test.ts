import { describe, it, expect } from "vitest";
import { signSession, verifySession } from "./session";

const SECRET = "test-secret-value";

describe("session", () => {
  it("round-trips an athlete id", async () => {
    const token = await signSession(42, SECRET);
    expect(await verifySession(token, SECRET)).toBe(42);
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(42, SECRET);
    const sig = token.split(".")[1] ?? "";
    expect(await verifySession(`99.${sig}`, SECRET)).toBeNull();
  });

  it("rejects a signature made with a different secret", async () => {
    const token = await signSession(42, SECRET);
    expect(await verifySession(token, "other-secret")).toBeNull();
  });

  it("rejects undefined and malformed values", async () => {
    expect(await verifySession(undefined, SECRET)).toBeNull();
    expect(await verifySession("nonsense", SECRET)).toBeNull();
  });

  it("throws loudly rather than signing with an empty secret", async () => {
    await expect(signSession(42, "")).rejects.toThrow("SESSION_SECRET is not configured");
  });

  it("throws loudly rather than verifying with an empty secret", async () => {
    const token = await signSession(42, SECRET);
    await expect(verifySession(token, "")).rejects.toThrow("SESSION_SECRET is not configured");
  });
});
