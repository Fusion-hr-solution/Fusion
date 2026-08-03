import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");
const developmentShellUrl =
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "";

const nextConfig: NextConfig = {
  // `pnpm build` is `turbo build` across every app, and a production build
  // writes the same `.next` a running `next dev` is serving from — which
  // replaces the dev server's chunks with hashed production ones it never asks
  // for, so every stylesheet and script 404s until dev is restarted. Separate
  // directories make the two incapable of colliding.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  basePath: "/platform",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/api", "@repo/auth", "@repo/ds"],
  allowedDevOrigins: ["http://localhost:3000"],
  env: {
    NEXT_PUBLIC_SHELL_URL:
      process.env.NEXT_PUBLIC_SHELL_URL ?? developmentShellUrl,
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/platform",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
