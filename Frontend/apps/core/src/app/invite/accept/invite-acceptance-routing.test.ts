import { describe, expect, it } from "vitest";
import type { AuthUser } from "@repo/auth";
import { resolveInviteAcceptanceDestination } from "./invite-acceptance-routing";

function createAuthUser(overrides: Partial<AuthUser>): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    email: "test@example.com",
    fullName: "Test User",
    roles: [],
    employeeId: null,
    accessProfiles: [],
    effectivePermissions: [],
    ...overrides,
  };
}

function grant(
  permissionKey: string,
  scope: "Self" | "DirectReports" | "Tenant"
): AuthUser["effectivePermissions"][number] {
  return {
    permissionKey,
    scope,
    label: permissionKey,
    group: "Test",
    helperText: null,
    allowedScopes: [scope],
  };
}

describe("resolveInviteAcceptanceDestination", () => {
  it("sends employees to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["Employee"],
        employeeId: "emp-1",
        effectivePermissions: [grant("core.profile.self.view", "Self")],
      }))
    ).toBe("/profile");
  });

  it("sends managers to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["Manager"],
        employeeId: "emp-1",
        effectivePermissions: [
          grant("core.team.view", "DirectReports"),
          grant("core.employee.view", "DirectReports"),
        ],
      }))
    ).toBe("/profile");
  });

  it("sends hr admins to setup summary", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["HRAdmin"],
        employeeId: null,
        effectivePermissions: [grant("core.setup.view", "Tenant")],
      }))
    ).toBe("/setup");
  });

  it("keeps platform admins on the admin workspace root", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["PlatformAdmin"],
        employeeId: null,
      }))
    ).toBe("/organizations");
  });
});
