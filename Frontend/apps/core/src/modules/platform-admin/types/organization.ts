/**
 * UI shapes for platform-admin organizations.
 * Populated from Identity platform-admin APIs via `map-platform-organization.ts`.
 */
export type OrganizationLifecycle =
  | "draft"
  | "invited"
  | "active"
  | "attention"
  | "suspended"
  | "archived";

export interface Organization {
  id: string;
  name: string;
  initials: string;
  lifecycle: OrganizationLifecycle;
  /** Raw Identity `operationalStatus` string (set when loaded from API). */
  operationalStatus?: string;
  adminStatus: string;
  userCount: number;
  pendingInvites: number;
  lastActivity: string | null;
  createdAt: string;
  description: string;
  internalNotes?: string;
  planTier?: string | null;
  primaryAdminName?: string;
  primaryAdminEmail?: string;
  inviteSentAt?: string;
  inviteExpiresAt?: string;
  /** Present when API returned a link (detail / resend). */
  inviteLink?: string | null;
  onboardingProgressPercent: number;
  onboardingStageTitle: string;
  onboardingStageSubtitle: string;
}

export interface OrganizationInvitePreview {
  organizationName: string;
  email: string;
  sessionId: string;
}
