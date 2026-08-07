import { describe, expect, it } from "vitest";
import { ADMIN_NAV } from "./sidebar-nav";

describe("tenant administration navigation", () => {
  it("routes Setup through the canonical shell URL without gating Access", () => {
    const setup = ADMIN_NAV.items.find((item) => item.label === "Setup");
    const access = ADMIN_NAV.items.find((item) => item.label === "Access");

    expect(setup).toMatchObject({
      href: "/tenant-setup",
      navigateHref: "/setup",
      shellRoute: true,
    });
    expect(setup?.disabled).not.toBe(true);
    expect(access).toMatchObject({ href: "/access" });
    expect(access?.disabled).not.toBe(true);
  });
});
