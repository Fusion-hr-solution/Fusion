import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("tenant foundation shell routing", () => {
  it("serves canonical /getting-started from the Core launchpad route", async () => {
    const configured = await nextConfig.rewrites?.();
    const beforeFiles =
      configured && !Array.isArray(configured) && "beforeFiles" in configured
        ? configured.beforeFiles
        : [];

    expect(beforeFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/getting-started",
          destination: expect.stringMatching(/\/core\/getting-started$/),
        }),
        expect.objectContaining({
          source: "/core/:path*",
          destination: expect.stringMatching(/\/core\/:path\*$/),
        }),
      ])
    );
  });

  it("redirects legacy /setup to the canonical foundation route without looping", async () => {
    const redirects = (await nextConfig.redirects?.()) ?? [];
    expect(redirects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/setup",
          destination: "/getting-started",
          permanent: false,
        }),
      ])
    );
    // The canonical target is never itself a redirect source.
    expect(redirects.some((rule) => rule.source === "/getting-started")).toBe(false);
  });

  it("no longer serves the retired /setup rewrite", async () => {
    const configured = await nextConfig.rewrites?.();
    const beforeFiles =
      (configured && !Array.isArray(configured) && "beforeFiles" in configured
        ? configured.beforeFiles
        : []) ?? [];
    expect(beforeFiles.some((rule) => rule.source === "/setup")).toBe(false);
  });
});
