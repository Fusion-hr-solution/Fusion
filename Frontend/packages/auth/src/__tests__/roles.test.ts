import { describe, expect, it } from "vitest";
import type { EffectivePermissionGrantDto, PermissionScope } from "@repo/api";
import {
  canAccessCorePeople,
  canAccessCoreSettings,
  canAccessCoreSetup,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  canAccessOrganizations,
  canSeeCorePeopleNavigation,
  canSeeCoreSettingsNavigation,
  canSeeCoreSetupNavigation,
  canSeeCoreTeamNavigation,
  canSeeOwnCoreProfileNavigation,
  canSeeOrganizationsNavigation,
} from "../roles";
import type { AuthUser } from "../types";

const CORE_PERMISSION = {
  overviewView: "core.overview.view",
  setupView: "core.setup.view",
  setupManage: "core.setup.manage",
  structureView: "core.structure.view",
  structureManage: "core.structure.manage",
  structurePublish: "core.structure.publish",
  employeeView: "core.employee.view",
  employeeManage: "core.employee.manage",
  employeeImport: "core.employee.import",
  reportingManage: "core.reporting.manage",
  orgChartView: "core.orgchart.view",
  accessView: "core.access.view",
  accessManage: "core.access.manage",
  settingsView: "core.settings.view",
  settingsManage: "core.settings.manage",
  accessProfilesManage: "core.accessprofiles.manage",
  profileSelfView: "core.profile.self.view",
  profileSelfUpdate: "core.profile.self.update",
  teamView: "core.team.view",
} as const;

const ROLE_PERMISSION_KEYS: Record<string, ReadonlyArray<readonly [string, PermissionScope]>> = {
  HRAdmin: [
    [CORE_PERMISSION.overviewView, "Tenant"],
    [CORE_PERMISSION.employeeView, "Tenant"],
    [CORE_PERMISSION.employeeManage, "Tenant"],
    [CORE_PERMISSION.employeeImport, "Tenant"],
    [CORE_PERMISSION.reportingManage, "Tenant"],
    [CORE_PERMISSION.orgChartView, "Tenant"],
    [CORE_PERMISSION.accessView, "Tenant"],
    [CORE_PERMISSION.accessManage, "Tenant"],
    [CORE_PERMISSION.settingsView, "Tenant"],
    [CORE_PERMISSION.settingsManage, "Tenant"],
    [CORE_PERMISSION.accessProfilesManage, "Tenant"],
    [CORE_PERMISSION.structureView, "Tenant"],
    [CORE_PERMISSION.structureManage, "Tenant"],
    [CORE_PERMISSION.structurePublish, "Tenant"],
    [CORE_PERMISSION.setupView, "Tenant"],
    [CORE_PERMISSION.setupManage, "Tenant"],
    [CORE_PERMISSION.profileSelfView, "Self"],
    [CORE_PERMISSION.profileSelfUpdate, "Self"],
    [CORE_PERMISSION.teamView, "DirectReports"],
  ],
  Manager: [
    [CORE_PERMISSION.profileSelfView, "Self"],
    [CORE_PERMISSION.profileSelfUpdate, "Self"],
    [CORE_PERMISSION.teamView, "DirectReports"],
    [CORE_PERMISSION.employeeView, "DirectReports"],
  ],
  Employee: [
    [CORE_PERMISSION.profileSelfView, "Self"],
    [CORE_PERMISSION.profileSelfUpdate, "Self"],
  ],
};

function buildGrant(permissionKey: string, scope: PermissionScope): EffectivePermissionGrantDto {
  return {
    permissionKey,
    scope,
    label: permissionKey,
    group: "Test",
    helperText: null,
    allowedScopes: [scope],
  };
}

function buildEffectivePermissions(roles: string[]): EffectivePermissionGrantDto[] {
  const grants = new Map<string, EffectivePermissionGrantDto>();

  for (const role of roles) {
    for (const [permissionKey, scope] of ROLE_PERMISSION_KEYS[role] ?? []) {
      const grant = buildGrant(permissionKey, scope);
      grants.set(`${grant.permissionKey}:${grant.scope}`, grant);
    }
  }

  return [...grants.values()];
}

function makeUser(roles: string[], employeeId: string | null = null): AuthUser {
  return {
    userId: "user-1",
    tenantId: "tenant-1",
    employeeId,
    email: "user@example.com",
    fullName: "Test User",
    roles,
    accessProfiles: [],
    effectivePermissions: buildEffectivePermissions(roles),
  };
}

describe("role helpers", () => {
  it("allows tenant HR admins to access setup and setup navigation", () => {
    const user = makeUser(["HRAdmin"]);

    expect(canAccessCorePeople(user)).toBe(true);
    expect(canAccessCoreSettings(user)).toBe(true);
    expect(canAccessCoreSetup(user)).toBe(true);
    expect(canSeeCorePeopleNavigation(user)).toBe(true);
    expect(canSeeCoreSettingsNavigation(user)).toBe(true);
    expect(canSeeCoreSetupNavigation(user)).toBe(true);
    expect(canAccessOrganizations(user)).toBe(false);
    expect(canSeeOrganizationsNavigation(user)).toBe(false);
  });

  it("allows linked managers to access self and team workspaces", () => {
    const user = makeUser(["Manager"], "employee-1");

    expect(canAccessOwnCoreProfile(user)).toBe(true);
    expect(canSeeOwnCoreProfileNavigation(user)).toBe(true);
    expect(canAccessCoreTeam(user)).toBe(true);
    expect(canSeeCoreTeamNavigation(user)).toBe(true);
    expect(canAccessCorePeople(user)).toBe(false);
  });

  it("allows linked employees to access self workspace but not team workspace", () => {
    const user = makeUser(["Employee"], "employee-1");

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
});
