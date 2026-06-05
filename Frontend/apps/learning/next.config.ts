import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  basePath: "/learning",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  allowedDevOrigins: ["http://localhost:3000"],
  experimental: {
    staleTimes: { dynamic: 0 },
    optimizePackageImports: ["lucide-react", "recharts", "@repo/ui"],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/learning",
        basePath: false,
        permanent: false,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:5000/api/:path*",
        basePath: false,
      },
    ];
  },
};

export default nextConfig;
