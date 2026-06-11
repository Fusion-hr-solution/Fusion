import type { AuthUser } from "./types";

export const PLATFORM_ADMIN_ROLE = "PlatformAdmin";
export const HR_ADMIN_ROLE = "HRAdmin";
export const MANAGER_ROLE = "Manager";
export const EMPLOYEE_ROLE = "Employee";
const CORE_TENANT_CONTEXT_STORAGE_KEY = "ey_core_tenant_context";

export function hasAnyRole(
  user: AuthUser | null,
  roles: readonly string[]
): boolean {
  if (!user) {
    return false;
  }

  return roles.some((role) => user.roles.includes(role));
}

function isTenantHrAdminOnly(user: AuthUser | null): boolean {
  return (
    hasAnyRole(user, [HR_ADMIN_ROLE]) &&
    !hasAnyRole(user, [PLATFORM_ADMIN_ROLE])
  );
}

function hasCoreTenantContext(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  const { pathname } = window.location;
  if (
    pathname !== "/core" &&
    !pathname.startsWith("/core/")
  ) {
    return false;
  }

  try {
    return !!sessionStorage.getItem(CORE_TENANT_CONTEXT_STORAGE_KEY);
  } catch {
    return false;
  }
}

function isPlatformAdminInCoreTenantContext(user: AuthUser | null): boolean {
  return hasAnyRole(user, [PLATFORM_ADMIN_ROLE]) && hasCoreTenantContext();
}

export function canAccessCoreSetup(user: AuthUser | null): boolean {
  return isTenantHrAdminOnly(user);
}

export function canSeeCoreSetupNavigation(user: AuthUser | null): boolean {
  return canAccessCoreSetup(user) || isPlatformAdminInCoreTenantContext(user);
}

export function canAccessCoreSettings(user: AuthUser | null): boolean {
  return isTenantHrAdminOnly(user) || isPlatformAdminInCoreTenantContext(user);
}

export function canSeeCoreSettingsNavigation(user: AuthUser | null): boolean {
  return canAccessCoreSettings(user);
}

export function canAccessCorePeople(user: AuthUser | null): boolean {
  return isTenantHrAdminOnly(user) || isPlatformAdminInCoreTenantContext(user);
}

export function canAccessCoreTeam(user: AuthUser | null): boolean {
  return !!user?.employeeId && hasAnyRole(user, [MANAGER_ROLE]);
}

export function canAccessOwnCoreProfile(user: AuthUser | null): boolean {
  return !!user?.employeeId;
}

export function canSeeCorePeopleNavigation(user: AuthUser | null): boolean {
  return canAccessCorePeople(user);
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
