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
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  async rewrites() {
    const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5000";
    const coreUrl = process.env.CORE_MFE_URL || "http://localhost:3002";
    const platformUrl =
      process.env.PLATFORM_MFE_URL || "http://localhost:3007";
    return { beforeFiles: [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
      },
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
