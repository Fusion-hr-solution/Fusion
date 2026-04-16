import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const AUTH_PATHS = ["/auth/signin", "/auth/signup"];

// Public routes that should be accessible without authentication
// 
// ARCHITECTURAL NOTE: /core/invite is a known compromise.
// It lives under the /core prefix but must remain publicly accessible for anonymous
// invite acceptance. This works via PUBLIC_PATHS bypass, but creates risk:
// - Future middleware changes could accidentally gate it
// - Routing refactors could break anonymous access
// - Not immediately obvious that /core/* has exceptions
// 
// Monitor this carefully if auth/routing architecture evolves. Consider moving
// invite acceptance outside /core if separation becomes clearer in the future.
const PUBLIC_PATHS = [
  "/core/invite", // Invite acceptance flow must be anonymous
  "/interview/candidate/start", // Candidate test access from invitation email
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authCookie = request.cookies.get("ey_hr_authenticated");
  const isAuthenticated = authCookie?.value === "true";

  // If authenticated and trying to access auth pages, redirect to home
  if (isAuthenticated && AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Allow auth pages for unauthenticated users
  if (AUTH_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Allow public paths without authentication (e.g., invite acceptance)
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
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
    signInUrl.searchParams.set("callbackUrl", `${pathname}${request.nextUrl.search}`);
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
