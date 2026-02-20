import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/core",
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: ["http://localhost:3000"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/core",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
