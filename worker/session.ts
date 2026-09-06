export const SESSION_COOKIE = "sd_session";

async function key(secret: string): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSession(athleteId: number, secret: string): Promise<string> {
  const payload = String(athleteId);
  const sig = await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(payload));
  return `${payload}.${toHex(sig)}`;
}

export async function verifySession(
  value: string | undefined,
  secret: string,
): Promise<number | null> {
  if (!value) return null;
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = value.slice(0, dot);
  const hex = value.slice(dot + 1);
  if (!/^[0-9]+$/.test(payload) || !/^[0-9a-f]+$/.test(hex) || hex.length % 2 !== 0) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);

  const ok = await crypto.subtle.verify(
    "HMAC",
    await key(secret),
    bytes,
    new TextEncoder().encode(payload),
  );
  return ok ? Number(payload) : null;
}
