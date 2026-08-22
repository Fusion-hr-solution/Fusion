import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");
const output =
  process.env.NEXT_STANDALONE === "true" ? "standalone" : undefined;

const nextConfig: NextConfig = {
  output,
  // `pnpm build` is `turbo build` across every app, and a production build
  // writes the same `.next` a running `next dev` is serving from — which
  // replaces the dev server's chunks with hashed production ones it never asks
  // for, so every stylesheet and script 404s until dev is restarted. Separate
  // directories make the two incapable of colliding.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/ds", "@repo/auth", "@repo/api"],
  experimental: {
    // The shell reverse-proxies module documents to each MFE via `rewrites()`.
    // Next's rewrite proxy defaults to a 30s timeout; when a Next dev server
    // compiles a route on first hit it can exceed that (measured ~33s for a cold
    // `/performance`), and the proxy then aborts with a socket hang up (ECONNRESET)
    // and renders `/_error` — surfacing an intermittent "Internal Server Error"
    // document on the first visit to an un-compiled MFE route. This is a dev-only
    // trigger (production MFEs are prebuilt and answer in ms), so we raise the
    // proxy timeout only in development to let a slow cold compile finish instead
    // of resetting. Production keeps Next's sane 30s default (fail-fast), so a
    // genuinely slow/hung upstream is not masked there.
    proxyTimeout:
      process.env.NODE_ENV === "development" ? 180_000 : undefined,
  },
  async redirects() {
    // `/setup` is retired in favour of the canonical `/getting-started`. A
    // context-preserving compatibility redirect keeps old links and activation
    // handoffs working; it maps once, never loops, and restores no setup-era UI.
    return [
      {
        source: "/setup",
        destination: "/getting-started",
        permanent: false,
      },
    ];
  },
  async rewrites() {
    const coreUrl = process.env.CORE_MFE_URL || "http://localhost:3002";
    const platformUrl =
      process.env.PLATFORM_MFE_URL || "http://localhost:3007";
    // `/api/*` is intentionally NOT rewritten here. It is served by the explicit
    // proxy route handler (`src/app/api/[...path]/route.ts`), which preserves full
    // successful-proxy parity and attributes an unreachable Gateway as a typed 503
    // instead of the implicit rewrite's bare, unattributed 500. `_next` asset and
    // module rewrites below are unaffected.
    return { beforeFiles: [
      {
        source: "/platform/_next/:path*",
        destination: `${platformUrl}/platform/_next/:path*`,
      },
      {
        source: "/platform/:path*",
        destination: `${platformUrl}/platform/:path*`,
      },
      {
        source: "/interview/:path*",
        destination: "http://localhost:3001/interview/:path*",
      },
      // Getting Started is a tenant-level foundation destination, not a Core HR
      // one, so its canonical URL carries no module prefix. It is served from the
      // Core app because the tenant shell — sidebar, breadcrumbs, tenant session
      // — exists only there. Legacy `/setup` redirects here (see `redirects`).
      {
        source: "/getting-started",
        destination: `${coreUrl}/core/getting-started`,
      },
      {
        source: "/core/:path*",
        destination: `${coreUrl}/core/:path*`,
      },
      {
        source: "/invite/:path*",
        destination: `${coreUrl}/core/invite/:path*`,
      },
      {
        source: "/learning/:path*",
        destination: "http://localhost:3003/learning/:path*",
      },
      {
        source: "/performance/_next/:path*",
        destination: "http://localhost:3004/performance/_next/:path*",
      },
      {
        source: "/performance/:path*",
        destination: "http://localhost:3004/performance/:path*",
      },
      {
        source: "/recruitment/:path*",
        destination: "http://localhost:3005/recruitment/:path*",
      },
      {
        source: "/onboarding/:path*",
        destination: "http://localhost:3006/onboarding/:path*",
      },
    ] };
  },
};

export default nextConfig;
