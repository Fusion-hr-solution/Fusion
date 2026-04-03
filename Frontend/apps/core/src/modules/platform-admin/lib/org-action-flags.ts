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
 * Visibility rules for the organizations table row menu (mock / client-side until APIs exist).
 */
export function getOrganizationActionFlags(
  o: Organization
): OrganizationActionFlags {
  const hasPrimary = Boolean(o.primaryAdminEmail?.trim());
  const inviteExists =
    hasPrimary && Boolean(o.inviteSentAt || o.pendingInvites > 0);
  const invitePending = o.lifecycle === "invited" && o.pendingInvites > 0;
  const inviteOutstanding =
    o.lifecycle !== "suspended" &&
    hasPrimary &&
    (o.lifecycle === "invited" || o.lifecycle === "attention");

  return {
    showView: true,
    showContinueSetup:
      o.onboardingProgressPercent < 100 && o.lifecycle !== "suspended",
    showResendFirstAdminInvite: inviteOutstanding,
    showCopyInviteLink: inviteExists,
    showRevokeInvite: invitePending,
    showSuspend: o.lifecycle === "active",
    showReactivate: o.lifecycle === "suspended",
  };
}

export function buildInviteAcceptPath(org: Organization): string {
  const q = new URLSearchParams();
  q.set("org", org.name);
  if (org.primaryAdminEmail) q.set("email", org.primaryAdminEmail);
  return `/core/invite/accept?${q.toString()}`;
}
