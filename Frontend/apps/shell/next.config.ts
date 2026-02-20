import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@repo/ui"],
  async rewrites() {
    return [
      {
        source: "/interview/:path*",
        destination: "http://localhost:3001/interview/:path*",
      },
      {
        source: "/core/:path*",
        destination: "http://localhost:3002/core/:path*",
      },
      {
        source: "/learning/:path*",
        destination: "http://localhost:3003/learning/:path*",
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
    ];
  },
};

export default nextConfig;
