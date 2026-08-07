import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("tenant setup shell routing", () => {
  it("serves canonical /setup from the distinct Core launchpad route", async () => {
    const configured = await nextConfig.rewrites?.();
    const beforeFiles =
      configured && !Array.isArray(configured) && "beforeFiles" in configured
        ? configured.beforeFiles
        : [];

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/setup",
          destination: expect.stringMatching(/\/core\/tenant-setup$/),
        }),
        expect.objectContaining({
          source: "/core/:path*",
          destination: expect.stringMatching(/\/core\/:path\*$/),
        }),
      ])
    );
  });

  it("does not redirect between tenant setup and Core organization setup", () => {
    expect(nextConfig.redirects).toBeUndefined();
  });
});
