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
  status: "Invited" | "InProgress" | "Submitted";
  milestones: BackendCandidateTimelineMilestoneDto[];
}

export interface BackendCandidateProgressTimelineDto {
  testId: string;
  testTitle: string;
  candidateEmail: string;
  candidateName?: string;
  attempts: BackendCandidateAttemptTimelineDto[];
}