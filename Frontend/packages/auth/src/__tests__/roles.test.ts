import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  canAccessCorePeople,
  canAccessCoreSettings,
  canManageCoreSettings,
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
  canViewCoreAccessProfiles,
  canManageCoreAccessProfiles,
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
  scope: AuthUser["effectivePermissions"][number]["scope"]
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
        helperText: null,
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
        helperText: null,
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
        helperText: null,
        allowedScopes: ["Tenant"],
      },
    ]);

    expect(canAccessCoreSettings(user)).toBe(true);
    expect(canSeeCoreSettingsNavigation(user)).toBe(true);
  });

  it("uses section settings permissions for settings access", () => {
    const peopleDataAdmin = makeUser([], null, [
      grant("settings.peopleData.manage", "Tenant"),
    ]);
    const auditReader = makeUser([], null, [
      grant("settings.governance.view", "Tenant"),
    ]);

    expect(canAccessCoreSettings(peopleDataAdmin)).toBe(true);
    expect(canManageCoreSettings(peopleDataAdmin)).toBe(true);
    expect(canSeeCoreSettingsNavigation(peopleDataAdmin)).toBe(true);
    expect(canAccessCoreSettings(auditReader)).toBe(true);
    expect(canManageCoreSettings(auditReader)).toBe(false);
  });

  it("separates access profile view and manage capabilities", () => {
    const profileViewer = makeUser([], null, [
      grant("access.profiles.view", "Tenant"),
    ]);
    const profileManager = makeUser([], null, [
      grant("access.profiles.manage", "Tenant"),
    ]);

    expect(canViewCoreAccessProfiles(profileViewer)).toBe(true);
    expect(canManageCoreAccessProfiles(profileViewer)).toBe(false);
    expect(canSeeCoreSettingsNavigation(profileViewer)).toBe(true);
    expect(canViewCoreAccessProfiles(profileManager)).toBe(true);
    expect(canManageCoreAccessProfiles(profileManager)).toBe(true);
  });

  it("does not give platform admins tenant settings or profile management by tenant context alone", () => {
    window.history.replaceState({}, "", "/core/settings");
    window.sessionStorage.setItem(CORE_TENANT_CONTEXT_STORAGE_KEY, "tenant-1");

    const user = makeUser(["PlatformAdmin"]);

    expect(canAccessCoreSettings(user)).toBe(false);
    expect(canManageCoreAccessProfiles(user)).toBe(false);
    expect(canSeeCoreSettingsNavigation(user)).toBe(false);
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
    expect(canSeeCoreSettingsNavigation(profileManager)).toBe(true);
  });


});


