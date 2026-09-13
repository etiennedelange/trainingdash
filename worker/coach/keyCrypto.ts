const IV_LENGTH = 12;

/** Derives an AES-GCM key from an existing env secret, the same way
 *  session.ts derives an HMAC key from SESSION_SECRET — no separate
 *  encryption secret to provision. */
async function deriveKey(secret: string): Promise<CryptoKey> {
  if (!secret) throw new Error("secret is not configured");
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return await crypto.subtle.importKey("raw", hash, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Encrypts a BYOK API key for storage in D1. The blob is iv‖ciphertext, base64-encoded. */
export async function encryptApiKey(plaintext: string, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await deriveKey(secret);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(plaintext),
  );
  const combined = new Uint8Array(iv.length + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), iv.length);
  return toBase64(combined);
}

/** Decrypts a blob produced by encryptApiKey. Returns null on any failure —
 *  wrong secret, corrupt blob, or garbage input — never throws. */
export async function decryptApiKey(blob: string, secret: string): Promise<string | null> {
  try {
    const combined = fromBase64(blob);
    if (combined.length <= IV_LENGTH) return null;
    const iv = combined.slice(0, IV_LENGTH);
    const ciphertext = combined.slice(IV_LENGTH);
    const key = await deriveKey(secret);
    const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
    return new TextDecoder().decode(plaintext);
  } catch {
    return null;
  }
}
