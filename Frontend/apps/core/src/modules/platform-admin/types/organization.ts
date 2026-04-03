/**
 * UI/domain shapes for platform-admin organizations.
 * Align field names with backend DTOs when APIs land; adjust only via mappers.
 */
export type OrganizationLifecycle =
  | "active"
  | "invited"
  | "attention"
  | "suspended";

export interface Organization {
  id: string;
  name: string;
  initials: string;
  lifecycle: OrganizationLifecycle;
  adminStatus: string;
  userCount: number;
  pendingInvites: number;
  lastActivity: string | null;
  createdAt: string;
  description: string;
  internalNotes?: string;
  primaryAdminName?: string;
  primaryAdminEmail?: string;
  inviteSentAt?: string;
  inviteExpiresAt?: string;
  onboardingProgressPercent: number;
  onboardingStageTitle: string;
  onboardingStageSubtitle: string;
}

export interface OrganizationInvitePreview {
  organizationName: string;
  email: string;
  sessionId: string;
}
