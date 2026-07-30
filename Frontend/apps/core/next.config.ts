import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");
const useStandaloneOutput = process.env.NEXT_OUTPUT_MODE === "standalone";
const developmentShellUrl =
  process.env.NODE_ENV === "development" ? "http://localhost:3000" : "";

const nextConfig: NextConfig = {
  ...(useStandaloneOutput ? { output: "standalone" as const } : {}),
  outputFileTracingRoot: frontendWorkspaceRoot,
  basePath: "/core",
  transpilePackages: ["@repo/api", "@repo/ui", "@repo/auth", "@repo/ds"],
  async rewrites() {
    const gateway = process.env.CORE_GATEWAY_URL ?? "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${gateway.replace(/\/$/, "")}/api/:path*`,
      },
    ];
  },
  allowedDevOrigins: ["http://localhost:3000"],
  env: {
    NEXT_PUBLIC_SHELL_URL:
      process.env.NEXT_PUBLIC_SHELL_URL ?? developmentShellUrl,
  },
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
    ];
  },
};

export default nextConfig;
