import {
  canAccessCoreOverview,
  canAccessCorePeople,
  canAccessCoreSetup,
  canAccessOrganizations,
  canAccessOwnCoreProfile,
  type AuthUser,
} from "@repo/auth";

export function resolveInviteAcceptanceDestination(
  user: AuthUser
): string {
  if (canAccessOrganizations(user)) {
    return "/organizations";
  }

  if (canAccessCoreSetup(user)) {
    return "/setup";
  }

  if (canAccessOwnCoreProfile(user)) {
    return "/profile";
  }

  if (canAccessCoreOverview(user) || canAccessCorePeople(user)) {
    return "/";
  }

  return "/";
}
