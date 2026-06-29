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
  it("sends access operators to Access", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        effectivePermissions: [grant("core.access.manage", "Tenant")],
      }))
    ).toBe("/access");
  });

  it("sends profile managers to Access Profiles", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        effectivePermissions: [grant("core.accessprofiles.manage", "Tenant")],
      }))
    ).toBe("/settings?tab=access-permissions");
  });

  it("sends employees to My Profile", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["Employee"],
        employeeId: "emp-1",
        effectivePermissions: [grant("core.profile.self.view", "Self")],
      }))
    ).toBe("/profile");
  });

  it("sends managers to My Team", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["Manager"],
        employeeId: "emp-1",
        effectivePermissions: [
          grant("core.team.view", "DirectReports"),
          grant("core.employee.view", "DirectReports"),
        ],
      }))
    ).toBe("/team");
  });

  it("sends overview users to Core overview", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
        roles: ["HRAdmin"],
        employeeId: null,
        effectivePermissions: [grant("core.overview.view", "Tenant")],
      }))
    ).toBe("/");
  });

  it("sends setup-only users to Setup", () => {
    expect(
      resolveInviteAcceptanceDestination(createAuthUser({
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
