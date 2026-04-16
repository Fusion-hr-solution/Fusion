import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  basePath: "/interview",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  allowedDevOrigins: ["http://localhost:3000"],
  async rewrites() {
    const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
        basePath: false,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/interview",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
