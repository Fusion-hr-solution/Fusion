import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/interview",
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: ["http://localhost:3000"],
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
