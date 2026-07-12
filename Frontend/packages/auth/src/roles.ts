import type { PermissionScope } from "@repo/api";
import type { AuthUser } from "./types";

export const PLATFORM_ADMIN_ROLE = "PlatformAdmin";
export const HR_ADMIN_ROLE = "HRAdmin";
export const MANAGER_ROLE = "Manager";
export const EMPLOYEE_ROLE = "Employee";

export const CORE_TENANT_CONTEXT_STORAGE_KEY = "ey_core_tenant_context";

const SELF_SCOPE_RANK = 1;
const DIRECT_REPORTS_SCOPE_RANK = 2;
const ORG_UNIT_SCOPE_RANK = 2;
const TENANT_SCOPE_RANK = 3;
const MODULE_SCOPE_RANK = 3;
const PLATFORM_SCOPE_RANK = 4;

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
  accessAssignmentsView: "access.assignments.view",
  accessAssignmentsManage: "access.assignments.manage",
  settingsOrganizationView: "settings.organization.view",
  settingsOrganizationManage: "settings.organization.manage",
  settingsPeopleDataView: "settings.peopleData.view",
  settingsPeopleDataManage: "settings.peopleData.manage",
  settingsStructureView: "settings.structure.view",
  settingsStructureManage: "settings.structure.manage",
  settingsProvisioningView: "settings.provisioning.view",
  settingsProvisioningManage: "settings.provisioning.manage",
  settingsGovernanceView: "settings.governance.view",
  accessProfilesView: "access.profiles.view",
  accessProfilesManageV2: "access.profiles.manage",
  settingsView: "core.settings.view",
  settingsManage: "core.settings.manage",
  accessProfilesManage: "core.accessprofiles.manage",
  profileSelfView: "core.profile.self.view",
  profileSelfUpdate: "core.profile.self.update",
  teamView: "core.team.view",
} as const;

const PERFORMANCE_PERMISSION = {
  cycleView: "performance.cycle.view",
  cycleManage: "performance.cycle.manage",
  cyclePublish: "performance.cycle.publish",
  objectivePlanningConfigurationView: "performance.objective.policy.view",
  objectivePlanningConfigurationManage: "performance.objective.policy.manage",
  objectiveTeamManage: "performance.objective.team.manage",
  strategicView: "performance.strategic.view",
} as const;

export function hasAnyRole(
  user: AuthUser | null,
  roles: readonly string[]
): boolean {
  if (!user) {
    return false;
  }

  return roles.some((role) => user.roles.includes(role));
}

function getScopeRank(scope: PermissionScope | null | undefined): number {
  switch (scope) {
    case "Tenant":
      return TENANT_SCOPE_RANK;
    case "DirectReports":
      return DIRECT_REPORTS_SCOPE_RANK;
    case "OrgUnit":
      return ORG_UNIT_SCOPE_RANK;
    case "Self":
      return SELF_SCOPE_RANK;
    case "Module":
      return MODULE_SCOPE_RANK;
    default:
      return scope === "Platform" ? PLATFORM_SCOPE_RANK : 0;
  }
}

function getEffectivePermissionScope(
  user: AuthUser | null,
  permissionKey: string
): PermissionScope | null {
  if (isPlatformAdminOutsideCoreTenantContext(user)) {
    return null;
  }

  if (!user?.effectivePermissions?.length) {
    return null;
  }

  let bestScope: PermissionScope | null = null;
  let bestRank = 0;

  for (const grant of user.effectivePermissions) {
    if (grant.permissionKey !== permissionKey) {
      continue;
    }

    const rank = getScopeRank(grant.scope);
    if (rank > bestRank) {
      bestRank = rank;
      bestScope = grant.scope;
    }
  }

  return bestScope;
}

export function hasCorePermission(
  user: AuthUser | null,
  permissionKey: string,
  requiredScope?: PermissionScope
): boolean {
  const grantedScope = getEffectivePermissionScope(user, permissionKey);
  if (!grantedScope) {
    return false;
  }

  if (!requiredScope) {
    return true;
  }

  return getScopeRank(grantedScope) >= getScopeRank(requiredScope);
}

export function hasAnyCorePermission(
  user: AuthUser | null,
  permissions: readonly string[]
): boolean {
  return permissions.some((permission) => hasCorePermission(user, permission));
}

function hasAnyTenantPermission(
  user: AuthUser | null,
  permissions: readonly string[]
): boolean {
  return permissions.some((permission) =>
    hasCorePermission(user, permission, "Tenant")
  );
}

function hasCoreTenantContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const pathname =
    typeof window.location?.pathname === "string"
      ? window.location.pathname
      : "";
  if (pathname !== "/core" && !pathname.startsWith("/core/")) {
    return false;
  }

  try {
    return !!sessionStorage.getItem(CORE_TENANT_CONTEXT_STORAGE_KEY);
  } catch {
    return false;
  }
}

function isPlatformAdminOutsideCoreTenantContext(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]) && !hasCoreTenantContext();
}

function isPlatformAdminInCoreTenantContext(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]) && hasCoreTenantContext();
}

export function canAccessCoreSetup(user: AuthUser | null): boolean {
  return (
    hasCorePermission(user, CORE_PERMISSION.setupView, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.setupManage, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.structureView, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.structureManage, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.structurePublish, "Tenant")
  );
}

export function canSeeCoreSetupNavigation(user: AuthUser | null): boolean {
  return canAccessCoreSetup(user) || isPlatformAdminInCoreTenantContext(user);
}

export function canAccessCoreSettings(user: AuthUser | null): boolean {
  return hasAnyTenantPermission(user, [
    CORE_PERMISSION.settingsOrganizationView,
    CORE_PERMISSION.settingsOrganizationManage,
    CORE_PERMISSION.settingsPeopleDataView,
    CORE_PERMISSION.settingsPeopleDataManage,
    CORE_PERMISSION.settingsStructureView,
    CORE_PERMISSION.settingsStructureManage,
    CORE_PERMISSION.settingsProvisioningView,
    CORE_PERMISSION.settingsProvisioningManage,
    CORE_PERMISSION.settingsGovernanceView,
    CORE_PERMISSION.settingsView,
    CORE_PERMISSION.settingsManage,
  ]);
}

export function canManageCoreSettings(user: AuthUser | null): boolean {
  return hasAnyTenantPermission(user, [
    CORE_PERMISSION.settingsOrganizationManage,
    CORE_PERMISSION.settingsPeopleDataManage,
    CORE_PERMISSION.settingsStructureManage,
    CORE_PERMISSION.settingsProvisioningManage,
    CORE_PERMISSION.settingsManage,
  ]);
}

export function canViewCoreAccessProfiles(user: AuthUser | null): boolean {
  return hasAnyTenantPermission(user, [
    CORE_PERMISSION.accessProfilesView,
    CORE_PERMISSION.accessProfilesManageV2,
    CORE_PERMISSION.accessProfilesManage,
    CORE_PERMISSION.accessView,
    CORE_PERMISSION.accessManage,
  ]);
}

export function canManageCoreAccessProfiles(user: AuthUser | null): boolean {
  return hasAnyTenantPermission(user, [
    CORE_PERMISSION.accessProfilesManageV2,
    CORE_PERMISSION.accessProfilesManage,
  ]);
}

export function canSeeCoreSettingsNavigation(user: AuthUser | null): boolean {
  return (
    canAccessCoreSettings(user) ||
    canViewCoreAccessProfiles(user)
  );
}

export function canAccessCorePeople(user: AuthUser | null): boolean {
  return hasCorePermission(user, CORE_PERMISSION.employeeView, "Tenant");
}

export function canManageCoreEmployees(user: AuthUser | null): boolean {
  return hasCorePermission(user, CORE_PERMISSION.employeeManage, "Tenant");
}

export function canImportCoreEmployees(user: AuthUser | null): boolean {
  return hasCorePermission(user, CORE_PERMISSION.employeeImport, "Tenant");
}

export function canManageCoreReporting(user: AuthUser | null): boolean {
  return hasCorePermission(user, CORE_PERMISSION.reportingManage, "Tenant");
}

export function canSeeCorePeopleNavigation(user: AuthUser | null): boolean {
  return canAccessCorePeople(user);
}

export function canAccessOwnCoreProfile(user: AuthUser | null): boolean {
  if (!user?.employeeId) {
    return false;
  }

  return (
    hasCorePermission(user, CORE_PERMISSION.profileSelfView, "Self") ||
    hasCorePermission(user, CORE_PERMISSION.employeeView, "Self") ||
    hasCorePermission(user, CORE_PERMISSION.employeeView, "DirectReports") ||
    hasCorePermission(user, CORE_PERMISSION.employeeView, "Tenant")
  );
}

export function canSeeOwnCoreProfileNavigation(user: AuthUser | null): boolean {
  return canAccessOwnCoreProfile(user);
}

export function canAccessCoreTeam(user: AuthUser | null): boolean {
  if (!user?.employeeId) {
    return false;
  }

  return (
    hasCorePermission(user, CORE_PERMISSION.teamView, "DirectReports") ||
    hasCorePermission(user, CORE_PERMISSION.employeeView, "DirectReports") ||
    hasCorePermission(user, CORE_PERMISSION.employeeView, "Tenant")
  );
}

export function canSeeCoreTeamNavigation(user: AuthUser | null): boolean {
  return canAccessCoreTeam(user);
}

export function canAccessCoreOrgChart(user: AuthUser | null): boolean {
  return (
    hasCorePermission(user, CORE_PERMISSION.orgChartView, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.orgChartView, "DirectReports")
  );
}

export function canSeeCoreOrgChartNavigation(user: AuthUser | null): boolean {
  return canAccessCoreOrgChart(user) || isPlatformAdminInCoreTenantContext(user);
}

export function canAccessCoreOverview(user: AuthUser | null): boolean {
  return hasCorePermission(user, CORE_PERMISSION.overviewView, "Tenant");
}

export function canAccessCoreAccess(user: AuthUser | null): boolean {
  return (
    hasCorePermission(user, CORE_PERMISSION.accessView, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.accessManage, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.accessAssignmentsView, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.accessAssignmentsManage, "Tenant") ||
    isPlatformAdminInCoreTenantContext(user)
  );
}

export function canManageCoreAccess(user: AuthUser | null): boolean {
  return (
    hasCorePermission(user, CORE_PERMISSION.accessManage, "Tenant") ||
    hasCorePermission(user, CORE_PERMISSION.accessAssignmentsManage, "Tenant")
  );
}

export function canSeeCoreAccessNavigation(user: AuthUser | null): boolean {
  return (
    canAccessCoreAccess(user) ||
    canViewCoreAccessProfiles(user) ||
    isPlatformAdminInCoreTenantContext(user)
  );
}

export function canAccessTenantAccessProfiles(user: AuthUser | null): boolean {
  return isPlatformAdminInCoreTenantContext(user);
}

export function canAccessOrganizations(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
}

export function canSeeOrganizationsNavigation(user: AuthUser | null): boolean {
  return canAccessOrganizations(user);
}

export function canAccessTenantContext(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
}

export function canAccessTenantSurfaces(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]);
}

// ── Performance module ───────────────────────────────────────────────

export function canViewPerformanceCycles(user: AuthUser | null): boolean {
  return (
    hasCorePermission(user, PERFORMANCE_PERMISSION.cycleView, "Tenant") ||
    hasCorePermission(user, PERFORMANCE_PERMISSION.cycleManage, "Tenant") ||
    hasCorePermission(user, PERFORMANCE_PERMISSION.cyclePublish, "Tenant")
  );
}

export function canManagePerformanceCycles(user: AuthUser | null): boolean {
  return hasCorePermission(user, PERFORMANCE_PERMISSION.cycleManage, "Tenant");
}

export const canViewPerformanceCampaigns = canViewPerformanceCycles;
export const canManagePerformanceCampaigns = canManagePerformanceCycles;

export function canOperatePerformanceCycles(user: AuthUser | null): boolean {
  return hasCorePermission(user, PERFORMANCE_PERMISSION.cyclePublish, "Tenant");
}

export function canViewObjectivePlanningConfiguration(user: AuthUser | null): boolean {
  return (
    hasCorePermission(user, PERFORMANCE_PERMISSION.objectivePlanningConfigurationView, "Tenant") ||
    hasCorePermission(user, PERFORMANCE_PERMISSION.objectivePlanningConfigurationManage, "Tenant")
  );
}

export function canManageObjectivePlanningConfiguration(user: AuthUser | null): boolean {
  return hasCorePermission(
    user,
    PERFORMANCE_PERMISSION.objectivePlanningConfigurationManage,
    "Tenant"
  );
}

/**
 * Team-objective authoring door: any catalog scope of the permission qualifies —
 * the effective scope is the campaign's frozen approver baseline, enforced server-side.
 */
export function canManageTeamObjectives(user: AuthUser | null): boolean {
  return hasCorePermission(user, PERFORMANCE_PERMISSION.objectiveTeamManage);
}

/**
 * Manager door: authoring team objectives is keyed to the frozen approver, so it is only
 * reachable by an account linked to an employee record. HR/Org admins hold the permission at
 * Tenant scope but are never named as a frozen approver, so the door stays hidden for them —
 * fail closed rather than surface an action the account can never complete.
 */
export function canAccessTeamObjectives(user: AuthUser | null): boolean {
  if (!user?.employeeId) {
    return false;
  }

  return canManageTeamObjectives(user);
}

/** Direction door: strategy and cascade coverage without HR campaign permissions. */
export function canViewPerformanceStrategy(user: AuthUser | null): boolean {
  return hasCorePermission(user, PERFORMANCE_PERMISSION.strategicView, "Tenant");
}

export function canAccessPerformance(user: AuthUser | null): boolean {
  return (
    canViewPerformanceCycles(user) ||
    canViewObjectivePlanningConfiguration(user) ||
    canManageTeamObjectives(user) ||
    canViewPerformanceStrategy(user)
  );
}
