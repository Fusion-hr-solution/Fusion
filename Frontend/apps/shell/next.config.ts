import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  async rewrites() {
    const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5000";
    const coreUrl = process.env.CORE_MFE_URL || "http://localhost:3002";
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
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
