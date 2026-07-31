import path from "node:path";
import type { NextConfig } from "next";

const frontendWorkspaceRoot = path.resolve(process.cwd(), "../..");

const nextConfig: NextConfig = {
  basePath: "/interview",
  outputFileTracingRoot: frontendWorkspaceRoot,
  transpilePackages: ["@repo/ui", "@repo/auth", "@repo/api"],
  allowedDevOrigins: ["http://localhost:3000"],
  async rewrites() {
    const gatewayUrl = process.env.GATEWAY_URL || "http://localhost:5000";
    return [
      {
        source: "/api/:path*",
        destination: `${gatewayUrl}/api/:path*`,
        basePath: false,
      },
    ];
  },
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
  async headers() {
    // WebContainers need SharedArrayBuffer, which the browser only exposes when the document is
    // cross-origin isolated (COOP: same-origin + COEP: require-corp). Crucially, an iframe is only
    // isolated when the ENTIRE frame tree is — so the top-level exam page (/candidate/start) must
    // carry these headers too, not just the embedded sandbox iframe. We scope them to the
    // candidate routes only, so the rest of /interview (authoring, dashboards) is unaffected.
    // (Verified: the app loads no cross-origin fonts/CDN assets, and API calls go through the
    // same-origin /api rewrite, so require-corp doesn't break the exam page.)
    const isolation = [
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
      { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
    ];
    return [
      { source: "/candidate/:path*", headers: isolation },
    ];
  },
};

export default nextConfig;
