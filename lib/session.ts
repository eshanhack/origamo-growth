/**
 * Minimal stateless session cookie using Web Crypto HMAC-SHA256.
 *
 * Cookie value format:  <base64url(payload)>.<base64url(sig)>
 * Payload JSON:         { exp: <unix ms> }
 *
 * Works in both the Node runtime (API routes) and the Edge runtime
 * (middleware) — Web Crypto is available in both.
 */

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const SESSION_COOKIE = "origamo_session";
export const SESSION_LIFETIME_MS = 1000 * 60 * 60 * 24 * 30; // 30 days

async function getKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): ArrayBuffer {
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(padLen);
  const bin = atob(padded);
  const buf = new ArrayBuffer(bin.length);
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return buf;
}

export async function createSessionCookie(secret: string): Promise<string> {
  const payload = JSON.stringify({ exp: Date.now() + SESSION_LIFETIME_MS });
  const payloadB64 = b64urlEncode(encoder.encode(payload));
  const key = await getKey(secret);
  const sigBuf = await crypto.subtle.sign("HMAC", key, encoder.encode(payloadB64));
  return `${payloadB64}.${b64urlEncode(sigBuf)}`;
}

export async function verifySessionCookie(
  cookie: string | undefined | null,
  secret: string,
): Promise<boolean> {
  if (!cookie) return false;
  const dot = cookie.indexOf(".");
  if (dot <= 0 || dot === cookie.length - 1) return false;
  const payloadB64 = cookie.slice(0, dot);
  const sigB64 = cookie.slice(dot + 1);
  try {
    const key = await getKey(secret);
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      b64urlDecode(sigB64),
      encoder.encode(payloadB64),
    );
    if (!valid) return false;
    const payload = JSON.parse(decoder.decode(b64urlDecode(payloadB64)));
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

/** Constant-time string compare (prevents timing oracle on the password). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
