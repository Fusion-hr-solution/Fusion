import type {
  PlatformOrganizationDetailDto,
  PlatformOrganizationSummaryDto,
} from "@repo/api";
import type { Organization, OrganizationLifecycle } from "../types/organization";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "OR";
}

function formatShortStamp(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatCreatedDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatLastActivity(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return formatShortStamp(iso) ?? null;
}

export function mapOperationalStatusToLifecycle(
  operationalStatus: string
): OrganizationLifecycle {
  switch (operationalStatus) {
    case "draft":
      return "draft";
    case "invited":
      return "invited";
    case "active":
      return "active";
    case "attention":
      return "attention";
    case "suspended":
      return "suspended";
    case "archived":
      return "archived";
    default:
      return "attention";
  }
}

function progressFromLifecycle(lifecycle: OrganizationLifecycle): number {
  switch (lifecycle) {
    case "active":
    case "archived":
      return 100;
    case "invited":
      return 45;
    case "draft":
      return 15;
    case "attention":
      return 35;
    case "suspended":
      return 0;
    default:
      return 0;
  }
}

function stageFromLifecycle(lifecycle: OrganizationLifecycle): {
  title: string;
  subtitle: string;
} {
  switch (lifecycle) {
    case "draft":
      return {
        title: "Draft",
        subtitle: "Invite the first administrator",
      };
    case "invited":
      return {
        title: "Awaiting Acceptance",
        subtitle: "First admin invite outstanding",
      };
    case "active":
      return {
        title: "Live",
        subtitle: "Organization is operational",
      };
    case "attention":
      return {
        title: "Action needed",
        subtitle: "Resolve onboarding or invite issues",
      };
    case "suspended":
      return {
        title: "Suspended",
        subtitle: "Access blocked",
      };
    case "archived":
      return {
        title: "Archived",
        subtitle: "Historical record",
      };
    default:
      return { title: "—", subtitle: "—" };
  }
}

function descriptionFor(lifecycle: OrganizationLifecycle, name: string): string {
  switch (lifecycle) {
    case "draft":
      return `${name} is created; send the first administrator invite to continue setup.`;
    case "invited":
      return `${name} is provisioned. Waiting for the primary administrator to accept the invitation.`;
    case "active":
      return `${name} is live. Customer administrators manage day-to-day membership.`;
    case "attention":
      return `${name} needs attention: expired or failed onboarding — resend or replace the invite.`;
    case "suspended":
      return `${name} is suspended; tenant access is blocked until reactivated.`;
    case "archived":
      return `${name} is archived and offboarded.`;
    default:
      return name;
  }
}

function displayNameFromDetail(d: PlatformOrganizationDetailDto): {
  primaryAdminName?: string;
  primaryAdminEmail?: string;
} {
  const inviteEmail = d.firstAdminInvite.email ?? undefined;
  const userEmail = d.primaryAdminEmail ?? undefined;
  const email = userEmail ?? inviteEmail;
  if (!email) {
    return {};
  }
  if (userEmail) {
    const local = email.split("@")[0] ?? "Admin";
    return {
      primaryAdminEmail: email,
      primaryAdminName: local.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    };
  }
  return {
    primaryAdminEmail: email,
    primaryAdminName: inviteEmail
      ? inviteEmail.split("@")[0]!.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
      : undefined,
  };
}

export function mapSummaryToOrganization(
  s: PlatformOrganizationSummaryDto
): Organization {
  const lifecycle = mapOperationalStatusToLifecycle(s.operationalStatus);
  const stage = stageFromLifecycle(lifecycle);
  return {
    id: s.id,
    name: s.name,
    initials: initialsFromName(s.name),
    lifecycle,
    operationalStatus: s.operationalStatus,
    adminStatus: s.firstAdminStatus,
    userCount: s.activeUserCount,
    pendingInvites: s.pendingInviteCount,
    lastActivity: formatLastActivity(s.lastActivityAt),
    createdAt: formatCreatedDate(s.createdAt),
    description: descriptionFor(lifecycle, s.name),
    onboardingProgressPercent: progressFromLifecycle(lifecycle),
    onboardingStageTitle: stage.title,
    onboardingStageSubtitle: stage.subtitle,
  };
}

export function mapDetailToOrganization(
  d: PlatformOrganizationDetailDto
): Organization {
  const lifecycle = mapOperationalStatusToLifecycle(d.operationalStatus);
  const stage = stageFromLifecycle(lifecycle);
  const names = displayNameFromDetail(d);
  const inv = d.firstAdminInvite;
  return {
    id: d.id,
    name: d.name,
    initials: initialsFromName(d.name),
    lifecycle,
    operationalStatus: d.operationalStatus,
    adminStatus: d.firstAdminStatus,
    userCount: d.activeUserCount,
    pendingInvites: d.pendingInviteCount,
    lastActivity: formatLastActivity(d.lastActivityAt),
    createdAt: formatCreatedDate(d.createdAt),
    description: descriptionFor(lifecycle, d.name),
    internalNotes: d.internalNotes ?? undefined,
    planTier: d.planTier ?? undefined,
    primaryAdminName: names.primaryAdminName,
    primaryAdminEmail: names.primaryAdminEmail,
    inviteSentAt: formatShortStamp(inv.sentAt ?? undefined),
    inviteExpiresAt: formatShortStamp(inv.expiresAt ?? undefined),
    inviteLink: inv.inviteLink ?? undefined,
    onboardingProgressPercent: progressFromLifecycle(lifecycle),
    onboardingStageTitle: stage.title,
    onboardingStageSubtitle: stage.subtitle,
  };
}
