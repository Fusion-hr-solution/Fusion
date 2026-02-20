import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/performance",
  transpilePackages: ["@repo/ui"],
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
