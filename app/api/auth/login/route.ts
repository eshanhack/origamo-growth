import { NextRequest, NextResponse } from "next/server";
import {
  SESSION_COOKIE,
  SESSION_LIFETIME_MS,
  constantTimeEqual,
  createSessionCookie,
} from "@/lib/session";

export const runtime = "nodejs";

// ─── Simple in-memory rate limit ──────────────────────────────────────────
// Keyed by IP. Good enough for a small internal dashboard; will reset on
// cold starts, which is fine — we just want to stop naive brute-forcing.
const WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 10;
type Attempt = { count: number; first: number };
const attempts = new Map<string, Attempt>();

function rateLimit(ip: string): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.first >= WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
    return { ok: true };
  }
  entry.count++;
  if (entry.count > MAX_ATTEMPTS) {
    return { ok: false, retryAfter: Math.ceil((WINDOW_MS - (now - entry.first)) / 1000) };
  }
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const expected = process.env.APP_PASSWORD;
  const secret = process.env.SESSION_SECRET;
  if (!expected || !secret) {
    return NextResponse.json(
      { error: "Auth not configured (set APP_PASSWORD and SESSION_SECRET)." },
      { status: 503 },
    );
  }

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";

  const rl = rateLimit(ip);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter ?? 60) } },
    );
  }

  let password = "";
  try {
    const body = await req.json();
    if (typeof body?.password === "string") password = body.password;
  } catch {
    /* ignore */
  }

  if (!constantTimeEqual(password, expected)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const cookie = await createSessionCookie(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, cookie, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_LIFETIME_MS / 1000),
  });
  return res;
}
