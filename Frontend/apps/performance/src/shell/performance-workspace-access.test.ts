import { describe, expect, it } from "vitest";
import type { AuthUser } from "@repo/auth";
import { resolvePerformanceWorkspaceAccessState } from "./performance-workspace-access";

const user: AuthUser = {
  userId: "user",
  tenantId: "tenant",
  tenantMembershipId: "membership",
  email: "employee@example.test",
  fullName: "Employee",
  roles: ["Employee"],
  moduleEntitlements: ["Performance"],
  accessProfiles: [],
  effectivePermissions: [
    {
      permissionKey: "performance.objective.self.manage",
      scope: "Self",
      label: "",
      group: "",
      helperText: null,
      allowedScopes: ["Self"],
    },
  ],
};

describe("Performance workspace entitlement", () => {
  it("blocks a tenant with another module but no Performance", () => {
    expect(resolvePerformanceWorkspaceAccessState({
      isLoading: false, user: { ...user, moduleEntitlements: ["CoreHR"] },
    })).toBe("module-unavailable");
  });

  it("allows an entitled tenant and denies a platform-only context", () => {
    expect(resolvePerformanceWorkspaceAccessState({ isLoading: false, user })).toBe("allowed");
    expect(resolvePerformanceWorkspaceAccessState({
      isLoading: false, user: { ...user, tenantId: null, roles: ["PlatformAdmin"] },
    })).toBe("forbidden");
  });

  it("refuses an entitled tenant user who holds no Performance permission", () => {
    expect(resolvePerformanceWorkspaceAccessState({
      isLoading: false, user: { ...user, effectivePermissions: [] },
    })).toBe("no-access");
  });

  it("keeps unresolved authentication inside the loading state", () => {
    expect(resolvePerformanceWorkspaceAccessState({ isLoading: true, user: null })).toBe("loading");
    expect(resolvePerformanceWorkspaceAccessState({ isLoading: false, user: null })).toBe("sign-in-required");
  });
});
