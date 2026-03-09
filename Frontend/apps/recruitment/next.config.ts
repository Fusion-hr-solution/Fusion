import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/recruitment",
  transpilePackages: ["@repo/ui", "@repo/auth"],
  allowedDevOrigins: ["http://localhost:3000"],
  async redirects() {
    return [
      {
        source: "/",
        destination: "/recruitment",
        basePath: false,
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
