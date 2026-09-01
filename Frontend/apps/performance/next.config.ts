import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  // `pnpm build` is `turbo build` across every app, and a production build
  // writes the same `.next` a running `next dev` is serving from — which
  // replaces the dev server's chunks with hashed production ones it never asks
  // for, so every stylesheet and script 404s until dev is restarted. Separate
  // directories make the two incapable of colliding.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  basePath: "/performance",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/auth", "@repo/api", "@repo/ds"],
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
      { source: "/reviews", destination: "/team", permanent: false },
      { source: "/contribution", destination: "/goals", permanent: false },
    ];
  },
};

export default nextConfig;
