import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  basePath: "/core",
  transpilePackages: ["@repo/api", "@repo/ui", "@repo/auth"],
  async rewrites() {
    const gateway =
      process.env.CORE_GATEWAY_URL ?? "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${gateway.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
  allowedDevOrigins: ["http://localhost:3000"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
        pathname: "/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/",
        destination: "/core",
        basePath: false,
        permanent: false,
      },
      // Legacy executive-console paths → flat /core/* routes
      {
        source: "/corehr",
        destination: "/organizations",
        permanent: false,
      },
      {
        source: "/corehr/:path*",
        destination: "/:path*",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
