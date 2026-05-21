import type { CandidateLinkSecuritySettings } from "@/types";

export interface BackendCandidateManagementOverviewDto {
  pendingInvitations: number;
  deliveryFailed: number;
  expiringLinks: number;
  inProgressCandidates: number;
  retakeRequests: number;
  pendingDeletion: number;
  generatedAtUtc: string;
}

export interface BackendCandidateInvitationDto {
  id: string;
  testId: string;
  testTitle: string;
  email: string;
  candidateName?: string;
  status: "Invited" | "DeliveryFailed" | "InProgress" | "Submitted" | "Expired";
  deadlineUtc?: string;
  inviteMethod?: "email" | "bulk" | "link";
  linkExpiryHours?: number;
  tokenCreatedAtUtc?: string;
  tokenExpiresAtUtc?: string;
  timeLimitMinutes?: number;
  customMessage?: string;
  inviteLink: string;
  createdAtUtc: string;
  lastSentAtUtc: string;
  resendCount: number;
  opensCount: number;
}

export interface InviteCandidateEntryInput {
  email: string;
  candidateName?: string;
}

export interface InviteCandidateInput {
  testId: string;
  emails: string[];
  candidateEntries?: InviteCandidateEntryInput[];
  inviteMethod: "email" | "bulk" | "link";
  candidateName?: string;
  deadlineUtc?: string;
  linkExpiryHours?: number;
  timeLimitMinutes?: number;
  customMessage?: string;
  sendNowNotification?: boolean;
}

export interface BackendCandidateLinkSecuritySettingsDto {
  singleUseLinkEnabled: boolean;
  emailVerificationEnabled: boolean;
  ipLockEnabled: boolean;
  browserFingerprintEnabled: boolean;
  linkValidForValue: number;
  linkValidForUnit: "days" | "hours" | "minutes";
  gracePeriodValue: number;
  gracePeriodUnit: "minutes" | "hours";
}

export interface BackendCandidateLinkPreviewDto {
  hasInvitation: boolean;
  invitationId?: string;
  inviteLink?: string;
  opensCount: number;
  allowedUses?: number;
  tokenExpiresAtUtc?: string;
  securityLevel: "Low" | "Medium" | "High";
}

export interface BackendCandidateLinkSecurityStateDto {
  testId: string;
  testTitle: string;
  settings: BackendCandidateLinkSecuritySettingsDto;
  preview: BackendCandidateLinkPreviewDto;
}

export interface BackendCandidateAttemptSettingsDto {
  defaultMaxAttempts: number;
}

export type BackendCandidatePrivacyActionType = "anonymize" | "delete-pii";

export interface BackendCandidatePrivacyActionResultDto {
  action: BackendCandidatePrivacyActionType;
  testId: string;
  adminId: string;
  triggerSource: string;
  candidateAliasEmail: string;
  candidateAliasName: string;
  candidateEmailHash: string;
  invitationIds: string[];
  invitationsUpdated: number;
  attemptsUpdated: number;
  eventsUpdated: number;
  loggedAtUtc: string;
}

export interface CandidatePrivacyActionInput {
  testId: string;
  candidateEmail?: string;
  invitationId?: string;
  action: BackendCandidatePrivacyActionType;
  adminId: string;
  triggerSource?: string;
}

export interface CandidatePrivacyActionBatchInput {
  testId: string;
  candidateEmails?: string[];
  invitationIds?: string[];
  action: BackendCandidatePrivacyActionType;
  adminId: string;
  triggerSource?: string;
}

export interface SaveCandidateAttemptSettingsInput {
  defaultMaxAttempts: number;
}

export interface SaveCandidateLinkSecurityInput extends CandidateLinkSecuritySettings {
  testId: string;
}

export interface BackendCandidateTimelineCandidateDto {
  candidateEmail: string;
  candidateName?: string;
  latestStatus: "Invited" | "DeliveryFailed" | "InProgress" | "Submitted" | "Expired";
  latestActivityAtUtc?: string;
}

export interface BackendCandidateTimelineMilestoneDto {
  name: "Invited" | "LinkOpened" | "Started" | "InProgress" | "Submitted";
  state: "Completed" | "Pending";
  occurredAtUtc?: string;
}

export interface BackendCandidateAttemptTimelineDto {
  attemptNumber: number;
  attemptId?: string;
  status: "Invited" | "PendingStart" | "InProgress" | "Submitted";
  milestones: BackendCandidateTimelineMilestoneDto[];
}

export interface BackendCandidateProgressTimelineDto {
  testId: string;
  testTitle: string;
  candidateEmail: string;
  candidateName?: string;
  attempts: BackendCandidateAttemptTimelineDto[];
}

export interface GrantCandidateRetakeInput {
  testId: string;
  candidateEmail: string;
}

export interface BackendCandidateRetakeGrantResultDto {
  testId: string;
  candidateEmail: string;
  candidateName?: string;
  invitationId: string;
  attemptId: string;
  attemptNumber: number;
  status: "PendingStart";
  notificationSent: boolean;
  inviteLink: string;
  tokenExpiresAtUtc: string;
}

export interface BackendCandidateRetentionSettingsDto {
  enabled: boolean;
  retentionAction: string;
  retentionPeriodDays: number;
  scanIntervalHours: number;
  lastRunAtUtc?: string;
}

export interface BackendCandidateRetentionRunDto {
  id: string;
  triggeredBy: string;
  triggerSource: string;
  retentionAction: string;
  retentionPeriodDays: number;
  candidatesScanned: number;
  candidatesProcessed: number;
  candidatesAnonymized: number;
  candidatesDeleted: number;
  candidatesExpired: number;
  startedAtUtc: string;
  completedAtUtc?: string;
}

export interface BackendCandidateRetentionStateDto {
  settings: BackendCandidateRetentionSettingsDto;
  pendingCount: number;
  recentRuns: BackendCandidateRetentionRunDto[];
}

export interface SaveCandidateRetentionSettingsInput {
  enabled: boolean;
  retentionAction: string;
  retentionPeriodDays: number;
  scanIntervalHours: number;
}

export interface RunCandidateRetentionInput {
  triggeredBy: string;
}