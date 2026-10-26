import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "./sidebar-nav";

describe("tenant administration navigation", () => {
  it("routes Getting Started through the canonical shell URL without gating Administrators", () => {
    const gettingStarted = ADMIN_NAV.items.find(
      (item) => item.label === "gettingStarted"
    );
    // Feature 02 keeps the /core/access route; the customer-facing name is "administrators".
    const administrators = ADMIN_NAV.items.find(
      (item) => item.label === "administrators"
    );

    expect(gettingStarted).toMatchObject({
      href: "/getting-started",
      navigateHref: "/getting-started",
      shellRoute: true,
    });
    expect(gettingStarted?.disabled).not.toBe(true);
    expect(administrators).toMatchObject({ href: "/access" });
    expect(administrators?.disabled).not.toBe(true);
  });

  it("exposes Workforce access ahead of Administrators", () => {
    const labels = ADMIN_NAV.items.map((item) => item.label);
    expect(labels).toContain("workforceAccess");
    const workforce = ADMIN_NAV.items.find((i) => i.label === "workforceAccess");
    expect(workforce).toMatchObject({ href: "/workforce-access" });
    expect(labels.indexOf("workforceAccess")).toBeLessThan(
      labels.indexOf("administrators")
    );
  });

  it("exposes no retired setup-era navigation", () => {
    for (const item of ADMIN_NAV.items) {
      expect(item.href).not.toBe("/setup");
      expect(item.href).not.toBe("/tenant-setup");
      expect(item.navigateHref).not.toBe("/setup");
    }
  });
});
