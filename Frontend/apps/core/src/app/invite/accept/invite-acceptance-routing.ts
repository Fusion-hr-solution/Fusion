import {
  canAccessCoreAccess,
  canAccessCoreOverview,
  canAccessCorePeople,
  canAccessCoreSetup,
  canAccessCoreSettings,
  canAccessCoreTeam,
  canAccessOrganizations,
  canAccessOwnCoreProfile,
  canManageCoreAccessProfiles,
  type AuthUser,
} from "@repo/auth";

export function resolveInviteAcceptanceDestination(
  user: AuthUser
): string {
  if (canAccessOrganizations(user)) {
    return "/organizations";
  }

  if (canAccessCoreOverview(user)) {
    return "/";
  }

  if (canAccessCoreAccess(user)) {
    return "/access";
  }

  if (canManageCoreAccessProfiles(user)) {
    return "/access/profiles";
  }

  if (canAccessCoreSetup(user)) {
    return "/setup";
  }

  if (canAccessCoreSettings(user)) {
    return "/settings";
  }

  if (canAccessCorePeople(user)) {
    return "/employees";
  }

  if (canAccessCoreTeam(user)) {
    return "/team";
  }

  if (canAccessOwnCoreProfile(user)) {
    return "/profile";
  }

  return "/";
}
