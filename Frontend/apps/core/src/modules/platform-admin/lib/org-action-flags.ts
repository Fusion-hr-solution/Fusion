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
  const hasPrimary = Boolean(o.primaryAdminEmail?.trim());
  const inviteExists =
    hasPrimary && Boolean(o.inviteSentAt || o.pendingInvites > 0);
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
 * Return the invite acceptance path if an invite link exists. Returns `null`
 * when no valid invite link is available—callers should hide the copy action.
 */
export function buildInviteAcceptPath(org: Organization): string | null {
  if (!org.inviteLink) return null;
  try {
    const u = new URL(org.inviteLink);
    return `${u.pathname}${u.search}`;
  } catch {
    return org.inviteLink.startsWith("/")
      ? org.inviteLink
      : `/${org.inviteLink}`;
  }
}
