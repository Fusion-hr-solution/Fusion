import path from "node:path";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

// Reads the language from NEXT_LOCALE through `src/i18n/request.ts`.
const withNextIntl = createNextIntlPlugin();

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");
const useStandaloneOutput = process.env.NEXT_OUTPUT_MODE === "standalone";
const developmentShellUrl =
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "";

const nextConfig: NextConfig = {
  ...(useStandaloneOutput ? { output: "standalone" as const } : {}),
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
  outputFileTracingRoot: frontendWorkspaceRoot,
  basePath: "/core",
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/ds", "@repo/performance-ui", "@repo/i18n"],
  async rewrites() {
    const gateway = process.env.CORE_GATEWAY_URL ?? "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${gateway.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
  allowedDevOrigins: ["http://localhost:3000"],
  env: {
    NEXT_PUBLIC_SHELL_URL:
      process.env.NEXT_PUBLIC_SHELL_URL ?? developmentShellUrl,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/core",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
