import {
  canAccessCoreAccess,
  canAccessCoreOverview,
  canAccessCorePeople,
  canAccessCoreSettings,
  canAccessCoreSetup,
  canAccessCoreTeam,
  canAccessOwnCoreProfile,
  canManageCoreAccessProfiles,
  type AuthUser,
} from "@repo/auth";

export function resolveInviteAcceptanceDestination(
  user: AuthUser
): string {
  if (canAccessCoreOverview(user)) {
    return "/";
  }

  if (canAccessCoreAccess(user)) {
    return "/access";
  }

  if (canManageCoreAccessProfiles(user)) {
    return "/settings?tab=access-permissions";
  }

  if (canAccessCoreSetup(user)) {
    return "/getting-started";
  }

  if (canAccessCoreSettings(user)) {
    return "/settings";
  }

  if (canAccessCorePeople(user)) {
    return "/people";
  }

  if (canAccessCoreTeam(user)) {
    return "/team";
  }

  if (canAccessOwnCoreProfile(user)) {
    return "/profile";
  }

  return "/";
}
