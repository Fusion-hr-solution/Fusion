import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canAccessCorePeople,
  canAccessCoreSettings,
  canAccessCoreSetup,
  canAccessCoreTeam,
  CORE_TENANT_CONTEXT_STORAGE_KEY,
  canAccessOwnCoreProfile,
  canAccessOrganizations,
  hasCorePermission,
  canSeeOwnCoreProfileNavigation,
  canSeeCorePeopleNavigation,
  canSeeCoreSettingsNavigation,
  canSeeCoreSetupNavigation,
  canSeeCoreAccessNavigation,
  canSeeCoreTeamNavigation,
  canSeeOrganizationsNavigation,
} from "../roles";
import type { AuthUser } from "../types";

function makeUser(
  roles: string[],
  employeeId?: string | null,
  effectivePermissions: AuthUser["effectivePermissions"] = []
): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    email: "user@example.com",
    fullName: "Test User",
    roles,
    employeeId,
    accessProfiles: [],
    effectivePermissions,
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
    allowedScopes: [scope],
  };
}

beforeEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});

describe("role helpers", () => {
  it("allows tenant HR admins to access setup and setup navigation", () => {
    const user = makeUser(["HRAdmin"], undefined, [
      grant("core.employee.view", "Tenant"),
      grant("core.settings.view", "Tenant"),
      grant("core.setup.view", "Tenant"),
    ]);

    expect(canAccessCorePeople(user)).toBe(true);
    expect(canAccessCoreSettings(user)).toBe(true);
    expect(canAccessCoreSetup(user)).toBe(true);
    expect(canSeeCorePeopleNavigation(user)).toBe(true);
    expect(canSeeCoreSettingsNavigation(user)).toBe(true);
    expect(canSeeCoreSetupNavigation(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(false);
    expect(canAccessOwnCoreProfile(user)).toBe(false);
    expect(canAccessOrganizations(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(false);
  });

  it("allows linked managers to access self and team workspaces", () => {
    const user = makeUser(["Manager"], "employee-1", [
      grant("core.profile.self.view", "Self"),
      grant("core.team.view", "DirectReports"),
      grant("core.employee.view", "DirectReports"),
    ]);

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canSeeOwnCoreProfileNavigation(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(true);
    expect(canSeeCoreTeamNavigation(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
  });

  it("allows linked employees to access self workspace but not team workspace", () => {
    const user = makeUser(["Employee"], "employee-1", [
      grant("core.profile.self.view", "Self"),
    ]);

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canSeeOwnCoreProfileNavigation(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(false);
    expect(canSeeCoreTeamNavigation(user)).toBe(false);
  });

  it("allows platform admins to access organizations but not setup", () => {
    const user = makeUser(["PlatformAdmin"]);

    expect(canAccessOrganizations(user)).toBe(true);
    expect(canSeeOrganizationsNavigation(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
    expect(canAccessCoreSettings(user)).toBe(false);
    expect(canAccessCoreSetup(user)).toBe(false);
    expect(canSeeCorePeopleNavigation(user)).toBe(false);
    expect(canSeeCoreSettingsNavigation(user)).toBe(false);
    expect(canSeeCoreSetupNavigation(user)).toBe(false);
  });

  it("keeps combined-role users in platform admin mode by default", () => {
    const user = makeUser(["PlatformAdmin", "HRAdmin"]);

    expect(canAccessOrganizations(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
    expect(canAccessCoreSettings(user)).toBe(false);
    expect(canAccessCoreSetup(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(true);
    expect(canSeeCorePeopleNavigation(user)).toBe(false);
    expect(canSeeCoreSettingsNavigation(user)).toBe(false);
    expect(canSeeCoreSetupNavigation(user)).toBe(false);
  });

  it("allows linked employees to access only their own profile", () => {
    const user = makeUser(["Employee"], "employee-1", [
      grant("core.profile.self.view", "Self"),
    ]);

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(false);
    expect(canAccessCorePeople(user)).toBe(false);
  });

  it("allows linked managers to access team scope", () => {
    const user = makeUser(["Manager"], "employee-1", [
      grant("core.team.view", "DirectReports"),
      grant("core.employee.view", "DirectReports"),
    ]);

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
  });

  it("blocks unlinked managers from team scope", () => {
    const user = makeUser(["Manager"]);

    expect(canAccessOwnCoreProfile(user)).toBe(false);
    expect(canAccessCoreTeam(user)).toBe(false);
  });

  it("uses effective permissions for tenant hr access", () => {
    const user = makeUser([], "employee-1", [
      {
        permissionKey: "core.employee.view",
        scope: "Tenant",
        label: "View employees",
        group: "Employees",
        allowedScopes: ["Self", "DirectReports", "Tenant"],
      },
    ]);

    expect(hasCorePermission(user, "core.employee.view", "Tenant")).toBe(true);
    expect(canAccessCorePeople(user)).toBe(true);
  });

  it("suppresses core permissions for platform admins outside tenant context", () => {
    const user = makeUser(["PlatformAdmin", "HRAdmin"], "employee-1", [
      {
        permissionKey: "core.employee.view",
        scope: "Tenant",
        label: "View employees",
        group: "Employees",
        allowedScopes: ["Self", "DirectReports", "Tenant"],
      },
    ]);

    expect(canAccessCorePeople(user)).toBe(false);
  });

  it("allows platform admins to use core permissions inside tenant context", () => {
    window.history.replaceState({}, "", "/core/settings");
    window.sessionStorage.setItem(CORE_TENANT_CONTEXT_STORAGE_KEY, "tenant-1");

    const user = makeUser(["PlatformAdmin", "HRAdmin"], "employee-1", [
      {
        permissionKey: "core.settings.view",
        scope: "Tenant",
        label: "View Core settings",
        group: "Settings",
        allowedScopes: ["Tenant"],
      },
    ]);

    expect(canAccessCoreSettings(user)).toBe(true);
    expect(canSeeCoreSettingsNavigation(user)).toBe(true);
  });

  it("shows access navigation for access-only and profile managers", () => {
    const accessViewer = makeUser([], null, [
      grant("core.access.view", "Tenant"),
    ]);
    const profileManager = makeUser([], null, [
      grant("core.accessprofiles.manage", "Tenant"),
    ]);

    expect(canSeeCoreAccessNavigation(accessViewer)).toBe(true);
    expect(canSeeCoreAccessNavigation(profileManager)).toBe(true);
  });
});
