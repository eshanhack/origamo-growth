import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionCookie } from "@/lib/session";

export const config = {
  // Match every request except Next internals, static files, the favicon,
  // the logo on the login page, the /login route itself, and the login API.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|logo.png|login$|login/|api/auth/login).*)",
  ],
};

export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET;

  // If the server isn't configured, block everything — fail closed.
  if (!secret) {
    if (req.nextUrl.pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "auth not configured (set SESSION_SECRET and APP_PASSWORD)" },
        { status: 503 },
      );
    }
    return new NextResponse(
      "Auth not configured — set SESSION_SECRET and APP_PASSWORD in env.",
      { status: 503 },
    );
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySessionCookie(cookie, secret);
  if (ok) return NextResponse.next();

  // Unauthenticated: API → 401, pages → redirect to /login
  if (req.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}
