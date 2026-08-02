import { describe, expect, it } from "vitest";
import type { AuthUser } from "@repo/auth";
import { resolveShellEntryState } from "./shell-entry";

function makeUser(roles: string[]): AuthUser {
  return {
    userId: "user-1",
    tenantId: "",
  tenantMembershipId: "membership-1",
  moduleEntitlements: ["CoreHR", "Performance"],
    email: "user@example.com",
    fullName: "Test User",
    roles,
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
  };
}

describe("resolveShellEntryState", () => {
  it("keeps the destination hidden while the session resolves", () => {
    expect(
      resolveShellEntryState({
        isLoading: true,
        user: makeUser(["PlatformAdmin"]),
      }),
    ).toBe("loading");
  });

  it("routes platform administrators to the control plane", () => {
    expect(
      resolveShellEntryState({
        isLoading: false,
        user: makeUser(["PlatformAdmin"]),
      }),
    ).toBe("platform");
  });

  it("preserves the current home for tenant users", () => {
    expect(
      resolveShellEntryState({
        isLoading: false,
        user: makeUser(["HRAdmin"]),
      }),
    ).toBe("home");
  });

  it("does not manufacture a Platform card for other accounts", () => {
    expect(
      resolveShellEntryState({
        isLoading: false,
        user: makeUser([]),
      }),
    ).toBe("home");
  });
});
