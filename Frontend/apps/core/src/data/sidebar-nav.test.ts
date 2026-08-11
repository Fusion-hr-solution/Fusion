import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "./sidebar-nav";

describe("tenant administration navigation", () => {
  it("routes Getting Started through the canonical shell URL without gating Access", () => {
    const gettingStarted = ADMIN_NAV.items.find(
      (item) => item.label === "Getting started"
    );
    const access = ADMIN_NAV.items.find((item) => item.label === "Access");

    expect(gettingStarted).toMatchObject({
      href: "/getting-started",
      navigateHref: "/getting-started",
      shellRoute: true,
    });
    expect(gettingStarted?.disabled).not.toBe(true);
    expect(access).toMatchObject({ href: "/access" });
    expect(access?.disabled).not.toBe(true);
  });

  it("exposes no retired setup-era navigation", () => {
    for (const item of ADMIN_NAV.items) {
      expect(item.href).not.toBe("/setup");
      expect(item.href).not.toBe("/tenant-setup");
      expect(item.navigateHref).not.toBe("/setup");
    }
  });
});
