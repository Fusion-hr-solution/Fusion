import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const AUTH_PATHS = ["/auth/signin", "/auth/signup"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("ey_hr_authenticated");
  const isAuthenticated = !!authCookie?.value;

  // If authenticated and trying to access auth pages, redirect to home
  if (isAuthenticated && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow auth pages for unauthenticated users
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow Next.js internals & static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  // Redirect unauthenticated users to sign in
  if (!isAuthenticated) {
    const signInUrl = new URL("/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except Next.js internals and static files.
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
