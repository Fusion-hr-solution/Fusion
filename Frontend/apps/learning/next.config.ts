import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  basePath: "/learning",
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  allowedDevOrigins: ["http://localhost:3000"],
  experimental: {
    // Disable router cache for dynamic routes so the catalog always reflects
    // the latest data after mutations (create/edit training).
    staleTimes: { dynamic: 0 },
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
};

export default nextConfig;
