import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Reads the language from NEXT_LOCALE through `src/i18n/request.ts`.
const withNextIntl = createNextIntlPlugin();

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  // `pnpm build` is `turbo build` across every app, and a production build
  // writes the same `.next` a running `next dev` is serving from — which
  // replaces the dev server's chunks with hashed production ones it never asks
  // for, so every stylesheet and script 404s until dev is restarted. Separate
  // directories make the two incapable of colliding.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: {
    // `next dev` keeps every compiled route in memory (~1.4 GB per app seen on a 14 GB dev machine);
    // past this soft limit Turbopack evicts and recompiles on demand instead of growing.
    turbopackMemoryLimit: 1024 * 1024 * 1024,
  },
  basePath: "/performance",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/auth", "@repo/api", "@repo/ds", "@repo/workforce-ui", "@repo/performance-ui", "@repo/i18n"],
  allowedDevOrigins: ["http://localhost:3000"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/performance",
        basePath: false,
        permanent: false,
      },
      // Surface-ownership consolidation: the former feature-chunk routes hand off to
      // their durable owners. Query strings (e.g. `?area=`) are forwarded automatically.
      { source: "/setup", destination: "/cycle", permanent: false },
      { source: "/contribution", destination: "/goals", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
