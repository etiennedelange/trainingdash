import { describe, it, expect } from "vitest";
import { encryptApiKey, decryptApiKey } from "./keyCrypto";

describe("keyCrypto", () => {
  it("round-trips a key under the same secret", async () => {
    const blob = await encryptApiKey("sk-ant-real-key", "secret-a");
    expect(await decryptApiKey(blob, "secret-a")).toBe("sk-ant-real-key");
  });

  it("returns null when decrypted with the wrong secret", async () => {
    const blob = await encryptApiKey("sk-ant-real-key", "secret-a");
    expect(await decryptApiKey(blob, "secret-b")).toBeNull();
  });

  it("returns null for garbage input instead of throwing", async () => {
    expect(await decryptApiKey("not-a-real-blob", "secret-a")).toBeNull();
    expect(await decryptApiKey("", "secret-a")).toBeNull();
  });

  it("produces a different blob each time (random iv)", async () => {
    const a = await encryptApiKey("sk-ant-real-key", "secret-a");
    const b = await encryptApiKey("sk-ant-real-key", "secret-a");
    expect(a).not.toBe(b);
  });
});
