import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");
const developmentShellUrl =
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "";

const nextConfig: NextConfig = {
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
