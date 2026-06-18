import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  basePath: "/performance",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  allowedDevOrigins: ["http://localhost:3000"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/performance",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
