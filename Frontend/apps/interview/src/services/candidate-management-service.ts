import { createPlatformApiClient } from "@repo/api";
import type {
  CandidateInvitation,
  CandidateLinkSecuritySettings,
  CandidateLinkSecurityState,
  CandidateManagementOverview,
} from "@/types";

const client = createPlatformApiClient();

interface BackendCandidateManagementOverviewDto {
  pendingInvitations: number;
  deliveryFailed: number;
  expiringLinks: number;
  inProgressCandidates: number;
  retakeRequests: number;
  pendingDeletion: number;
  generatedAtUtc: string;
}

interface BackendCandidateInvitationDto {
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

interface InviteCandidateEntryInput {
  email: string;
  candidateName?: string;
}

interface InviteCandidateInput {
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

interface BackendCandidateLinkSecuritySettingsDto {
  singleUseLinkEnabled: boolean;
  emailVerificationEnabled: boolean;
  ipLockEnabled: boolean;
  browserFingerprintEnabled: boolean;
  linkValidForValue: number;
  linkValidForUnit: "days" | "hours" | "minutes";
  gracePeriodValue: number;
  gracePeriodUnit: "minutes" | "hours";
}

interface BackendCandidateLinkPreviewDto {
  hasInvitation: boolean;
  invitationId?: string;
  inviteLink?: string;
  opensCount: number;
  allowedUses?: number;
  tokenExpiresAtUtc?: string;
  securityLevel: "Low" | "Medium" | "High";
}

interface BackendCandidateLinkSecurityStateDto {
  testId: string;
  testTitle: string;
  settings: BackendCandidateLinkSecuritySettingsDto;
  preview: BackendCandidateLinkPreviewDto;
}

interface SaveCandidateLinkSecurityInput extends CandidateLinkSecuritySettings {
  testId: string;
}

function mapInvitation(dto: BackendCandidateInvitationDto): CandidateInvitation {
  return {
    id: dto.id,
    testId: dto.testId,
    testTitle: dto.testTitle,
    email: dto.email,
    candidateName: dto.candidateName,
    status: dto.status,
    deadlineUtc: dto.deadlineUtc,
    inviteMethod: dto.inviteMethod,
    linkExpiryHours: dto.linkExpiryHours,
    tokenCreatedAtUtc: dto.tokenCreatedAtUtc,
    tokenExpiresAtUtc: dto.tokenExpiresAtUtc,
    timeLimitMinutes: dto.timeLimitMinutes,
    customMessage: dto.customMessage,
    inviteLink: dto.inviteLink,
    createdAtUtc: dto.createdAtUtc,
    lastSentAtUtc: dto.lastSentAtUtc,
    resendCount: dto.resendCount,
    opensCount: dto.opensCount,
  };
}

function mapLinkSecurityState(dto: BackendCandidateLinkSecurityStateDto): CandidateLinkSecurityState {
  return {
    testId: dto.testId,
    testTitle: dto.testTitle,
    settings: {
      singleUseLinkEnabled: dto.settings.singleUseLinkEnabled,
      emailVerificationEnabled: dto.settings.emailVerificationEnabled,
      ipLockEnabled: dto.settings.ipLockEnabled,
      browserFingerprintEnabled: dto.settings.browserFingerprintEnabled,
      linkValidForValue: dto.settings.linkValidForValue,
      linkValidForUnit: dto.settings.linkValidForUnit,
      gracePeriodValue: dto.settings.gracePeriodValue,
      gracePeriodUnit: dto.settings.gracePeriodUnit,
    },
    preview: {
      hasInvitation: dto.preview.hasInvitation,
      invitationId: dto.preview.invitationId,
      inviteLink: dto.preview.inviteLink,
      opensCount: dto.preview.opensCount,
      allowedUses: dto.preview.allowedUses,
      tokenExpiresAtUtc: dto.preview.tokenExpiresAtUtc,
      securityLevel: dto.preview.securityLevel,
    },
  };
}

export async function getCandidateManagementOverview(): Promise<CandidateManagementOverview> {
  const dto = await client.get<BackendCandidateManagementOverviewDto>(
    "/interview/candidates/management/overview"
  );

  return {
    pendingInvitations: dto.pendingInvitations,
    deliveryFailed: dto.deliveryFailed,
    expiringLinks: dto.expiringLinks,
    inProgressCandidates: dto.inProgressCandidates,
    retakeRequests: dto.retakeRequests,
    pendingDeletion: dto.pendingDeletion,
    generatedAtUtc: dto.generatedAtUtc,
  };
}

export async function getPendingInvitations(testId?: string): Promise<CandidateInvitation[]> {
  const data = await client.get<BackendCandidateInvitationDto[]>(
    "/interview/candidates/invitations/pending",
    { params: testId ? { testId } : undefined }
  );

  return data.map(mapInvitation);
}

export async function inviteCandidates(input: InviteCandidateInput): Promise<CandidateInvitation[]> {
  const cleanedEmails = input.emails
    .map((email) => email.trim())
    .filter((email) => email.length > 0);

  const normalizedEmailSet = new Set(cleanedEmails.map((email) => email.toLowerCase()));
  const candidateEntriesByEmail = new Map<string, { email: string; candidateName?: string }>();

  for (const entry of input.candidateEntries ?? []) {
    const normalizedEntryEmail = entry.email.trim().toLowerCase();
    if (!normalizedEntryEmail || !normalizedEmailSet.has(normalizedEntryEmail)) {
      continue;
    }

    const normalizedCandidateName = entry.candidateName?.trim() || undefined;
    const existingEntry = candidateEntriesByEmail.get(normalizedEntryEmail);
    if (!existingEntry || (!existingEntry.candidateName && normalizedCandidateName)) {
      candidateEntriesByEmail.set(normalizedEntryEmail, {
        email: normalizedEntryEmail,
        candidateName: normalizedCandidateName,
      });
    }
  }

  const candidateEntries = Array.from(candidateEntriesByEmail.values());

  if (cleanedEmails.length === 0) {
    throw new Error("Add at least one email before sending invitations.");
  }

  if (cleanedEmails.length === 1) {
    const singleEmail = cleanedEmails[0]!;
    const singleCandidateName =
      candidateEntriesByEmail.get(singleEmail.toLowerCase())?.candidateName ?? input.candidateName;

    const created = await client.post<BackendCandidateInvitationDto>(
      "/interview/candidates/invitations",
      {
        testId: input.testId,
        email: singleEmail,
        inviteMethod: input.inviteMethod,
        candidateName: singleCandidateName,
        deadlineUtc: input.deadlineUtc,
        linkExpiryHours: input.linkExpiryHours,
        timeLimitMinutes: input.timeLimitMinutes,
        customMessage: input.customMessage,
        sendNotification: input.sendNowNotification ?? true,
      }
    );
    return [mapInvitation(created)];
  }

  const created = await client.post<BackendCandidateInvitationDto[]>(
    "/interview/candidates/invitations/bulk",
    {
      testId: input.testId,
      emails: cleanedEmails,
      candidates: candidateEntries.length > 0 ? candidateEntries : undefined,
      inviteMethod: input.inviteMethod,
      candidateName: input.candidateName,
      deadlineUtc: input.deadlineUtc,
      linkExpiryHours: input.linkExpiryHours,
      timeLimitMinutes: input.timeLimitMinutes,
      customMessage: input.customMessage,
      sendNotification: input.sendNowNotification ?? true,
    }
  );

  return created.map(mapInvitation);
}

export async function resendInvitation(invitationId: string): Promise<CandidateInvitation> {
  const dto = await client.post<BackendCandidateInvitationDto>(
    `/interview/candidates/invitations/${encodeURIComponent(invitationId)}/resend`
  );

  return mapInvitation(dto);
}

export async function getCandidateLinkSecurityState(testId: string): Promise<CandidateLinkSecurityState> {
  const dto = await client.get<BackendCandidateLinkSecurityStateDto>(
    "/interview/candidates/management/link-security",
    { params: { testId } }
  );

  return mapLinkSecurityState(dto);
}

export async function saveCandidateLinkSecuritySettings(
  input: SaveCandidateLinkSecurityInput
): Promise<CandidateLinkSecurityState> {
  const dto = await client.put<BackendCandidateLinkSecurityStateDto>(
    "/interview/candidates/management/link-security",
    {
      testId: input.testId,
      singleUseLinkEnabled: input.singleUseLinkEnabled,
      emailVerificationEnabled: input.emailVerificationEnabled,
      ipLockEnabled: input.ipLockEnabled,
      browserFingerprintEnabled: input.browserFingerprintEnabled,
      linkValidForValue: input.linkValidForValue,
      linkValidForUnit: input.linkValidForUnit,
      gracePeriodValue: input.gracePeriodValue,
      gracePeriodUnit: input.gracePeriodUnit,
    }
  );

  return mapLinkSecurityState(dto);
}

export async function regenerateCandidateLinkSecurityLink(testId: string): Promise<CandidateLinkSecurityState> {
  const dto = await client.post<BackendCandidateLinkSecurityStateDto>(
    `/interview/candidates/management/link-security/${encodeURIComponent(testId)}/regenerate`
  );

  return mapLinkSecurityState(dto);
}
