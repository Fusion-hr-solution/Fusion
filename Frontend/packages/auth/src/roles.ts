import type { AuthUser } from "./types";

export const PLATFORM_ADMIN_ROLE = "PlatformAdmin";
export const HR_ADMIN_ROLE = "HRAdmin";

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

export function canAccessCoreSetup(user: AuthUser | null): boolean {
  return isTenantHrAdminOnly(user);
}

export function canSeeCoreSetupNavigation(user: AuthUser | null): boolean {
  return canAccessCoreSetup(user);
}

export function canAccessCoreSettings(user: AuthUser | null): boolean {
  return isTenantHrAdminOnly(user);
}

export function canSeeCoreSettingsNavigation(user: AuthUser | null): boolean {
  return canAccessCoreSettings(user);
}

export function canAccessCorePeople(user: AuthUser | null): boolean {
  return isTenantHrAdminOnly(user);
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
