import type { Organization } from "../types/organization";

export interface OrganizationActionFlags {
  showView: boolean;
  showContinueSetup: boolean;
  showResendFirstAdminInvite: boolean;
  showCopyInviteLink: boolean;
  showRevokeInvite: boolean;
  showSuspend: boolean;
  showReactivate: boolean;
}

/**
 * Row menu visibility from organization lifecycle (Identity-derived).
 */
export function getOrganizationActionFlags(
  o: Organization
): OrganizationActionFlags {
  const invitePending =
    (o.lifecycle === "invited" || o.lifecycle === "draft") &&
    o.pendingInvites > 0;
  const inviteOutstanding =
    o.lifecycle !== "suspended" &&
    o.lifecycle !== "archived" &&
    (o.lifecycle === "invited" ||
      o.lifecycle === "attention" ||
      o.lifecycle === "draft");

  return {
    showView: true,
    showContinueSetup:
      o.lifecycle !== "suspended" &&
      o.lifecycle !== "archived" &&
      o.onboardingProgressPercent < 100,
    showResendFirstAdminInvite: inviteOutstanding,
    showCopyInviteLink: Boolean(o.inviteLink),
    showRevokeInvite: invitePending,
    showSuspend: o.lifecycle === "active",
    showReactivate: o.lifecycle === "suspended",
  };
}

/**
 * Return the full invite acceptance URL. Preserves the absolute URL from the API
 * to avoid origin mismatches when PublicBaseUrl differs from admin console origin.
 */
export function buildInviteAcceptUrl(org: Organization): string | null {
  if (!org.inviteLink) return null;
  return org.inviteLink;
}
