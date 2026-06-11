import { describe, expect, it } from "vitest";
import {
  resolveSetupEntryRouteAction,
  shouldAutoActivateSetup,
} from "./setup-entry-routing";

describe("resolveSetupEntryRouteAction", () => {
  it("redirects locked non-setup routes into setup summary", () => {
    expect(
      resolveSetupEntryRouteAction({
        currentPath: "/employees",
        shouldCheckSetupAccess: true,
        isSetupLocked: true,
      })
    ).toBe("redirect-to-setup-summary");
  });

  it("keeps the pre-start setup summary route available", () => {
    expect(
      resolveSetupEntryRouteAction({
        currentPath: "/setup",
        shouldCheckSetupAccess: true,
        isSetupLocked: true,
      })
    ).toBe("allow");
  });

  it("keeps the setup summary route available when setup is unlocked", () => {
    expect(
      resolveSetupEntryRouteAction({
        currentPath: "/setup",
        shouldCheckSetupAccess: true,
        isSetupLocked: false,
      })
    ).toBe("allow");
  });

  it("lets the draft workspace handle pre-start activation in place", () => {
    expect(
      resolveSetupEntryRouteAction({
        currentPath: "/setup/draft-structure",
        shouldCheckSetupAccess: true,
        isSetupLocked: true,
      })
    ).toBe("allow");
  });
});

describe("shouldAutoActivateSetup", () => {
  it("returns true only when setup can still be started", () => {
    expect(shouldAutoActivateSetup(true)).toBe(true);
    expect(shouldAutoActivateSetup(false)).toBe(false);
    expect(shouldAutoActivateSetup(undefined)).toBe(false);
  });
});
