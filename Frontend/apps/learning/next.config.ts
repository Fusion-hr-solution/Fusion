import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/learning",
  transpilePackages: ["@repo/ui"],
  allowedDevOrigins: ["http://localhost:3000"],
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
};

export default nextConfig;
