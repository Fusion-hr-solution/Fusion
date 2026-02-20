import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/onboarding",
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: ["http://localhost:3000"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/onboarding",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
