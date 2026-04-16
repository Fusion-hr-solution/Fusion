import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  basePath: "/recruitment",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/ui", "@repo/auth"],
  allowedDevOrigins: ["http://localhost:3000"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/recruitment",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
