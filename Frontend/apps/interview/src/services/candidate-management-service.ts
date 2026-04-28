import { createPlatformApiClient } from "@repo/api";
import type {
  CandidateInvitation,
  CandidateProgressTimeline,
  CandidateLinkSecurityState,
  CandidateTimelineCandidate,
  CandidateManagementOverview,
} from "@/types";
import type {
  BackendCandidateManagementOverviewDto,
  BackendCandidateInvitationDto,
  InviteCandidateInput,
  BackendCandidateLinkSecurityStateDto,
  SaveCandidateLinkSecurityInput,
  BackendCandidateTimelineCandidateDto,
  BackendCandidateProgressTimelineDto,
  BackendCandidateRetakeGrantResultDto,
  GrantCandidateRetakeInput,
} from "./models/candidate-management-models";

const client = createPlatformApiClient();

const CANDIDATE_INVITATIONS_API = "/interview/candidates/invitations";
const CANDIDATE_MANAGEMENT_API = "/interview/candidates/management";

const CANDIDATE_INVITATIONS_PENDING_ENDPOINT = `${CANDIDATE_INVITATIONS_API}/pending`;
const CANDIDATE_INVITATIONS_BULK_ENDPOINT = `${CANDIDATE_INVITATIONS_API}/bulk`;

const CANDIDATE_MANAGEMENT_OVERVIEW_PATH = "/overview";
const CANDIDATE_MANAGEMENT_LINK_SECURITY_PATH = "/link-security";
const CANDIDATE_MANAGEMENT_TIMELINE_PATH = "/timeline";

const CANDIDATE_MANAGEMENT_OVERVIEW_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_OVERVIEW_PATH}`;
const CANDIDATE_MANAGEMENT_LINK_SECURITY_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_LINK_SECURITY_PATH}`;
const CANDIDATE_MANAGEMENT_TIMELINE_CANDIDATES_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_TIMELINE_PATH}/candidates`;
const CANDIDATE_MANAGEMENT_TIMELINE_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_TIMELINE_PATH}`;
const CANDIDATE_MANAGEMENT_RETAKE_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}/retake`;

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

function mapTimelineCandidate(dto: BackendCandidateTimelineCandidateDto): CandidateTimelineCandidate {
  return {
    candidateEmail: dto.candidateEmail,
    candidateName: dto.candidateName,
    latestStatus: dto.latestStatus,
    latestActivityAtUtc: dto.latestActivityAtUtc,
  };
}

function mapProgressTimeline(dto: BackendCandidateProgressTimelineDto): CandidateProgressTimeline {
  return {
    testId: dto.testId,
    testTitle: dto.testTitle,
    candidateEmail: dto.candidateEmail,
    candidateName: dto.candidateName,
    attempts: dto.attempts.map((attempt) => ({
      attemptNumber: attempt.attemptNumber,
      attemptId: attempt.attemptId,
      status: attempt.status,
      milestones: attempt.milestones.map((milestone) => ({
        name: milestone.name,
        state: milestone.state,
        occurredAtUtc: milestone.occurredAtUtc,
      })),
    })),
  };
}

export async function getCandidateManagementOverview(): Promise<CandidateManagementOverview> {
  const dto = await client.get<BackendCandidateManagementOverviewDto>(
    CANDIDATE_MANAGEMENT_OVERVIEW_ENDPOINT
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
    CANDIDATE_INVITATIONS_PENDING_ENDPOINT,
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
      CANDIDATE_INVITATIONS_API,
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
    CANDIDATE_INVITATIONS_BULK_ENDPOINT,
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
    `${CANDIDATE_INVITATIONS_API}/${encodeURIComponent(invitationId)}/resend`
  );

  return mapInvitation(dto);
}

export async function getCandidateLinkSecurityState(testId: string): Promise<CandidateLinkSecurityState> {
  const dto = await client.get<BackendCandidateLinkSecurityStateDto>(
    CANDIDATE_MANAGEMENT_LINK_SECURITY_ENDPOINT,
    { params: { testId } }
  );

  return mapLinkSecurityState(dto);
}

export async function saveCandidateLinkSecuritySettings(
  input: SaveCandidateLinkSecurityInput
): Promise<CandidateLinkSecurityState> {
  const dto = await client.put<BackendCandidateLinkSecurityStateDto>(
    CANDIDATE_MANAGEMENT_LINK_SECURITY_ENDPOINT,
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
    `${CANDIDATE_MANAGEMENT_LINK_SECURITY_ENDPOINT}/${encodeURIComponent(testId)}/regenerate`
  );

  return mapLinkSecurityState(dto);
}

export async function getCandidateTimelineCandidates(testId: string): Promise<CandidateTimelineCandidate[]> {
  const dto = await client.get<BackendCandidateTimelineCandidateDto[]>(
    CANDIDATE_MANAGEMENT_TIMELINE_CANDIDATES_ENDPOINT,
    { params: { testId } }
  );

  return dto.map(mapTimelineCandidate);
}

export async function getCandidateProgressTimeline(
  testId: string,
  candidateEmail: string
): Promise<CandidateProgressTimeline> {
  const dto = await client.get<BackendCandidateProgressTimelineDto>(
    CANDIDATE_MANAGEMENT_TIMELINE_ENDPOINT,
    { params: { testId, candidateEmail } }
  );

  return mapProgressTimeline(dto);
}

export async function grantCandidateRetake(input: GrantCandidateRetakeInput): Promise<BackendCandidateRetakeGrantResultDto> {
  return client.post<BackendCandidateRetakeGrantResultDto>(
    CANDIDATE_MANAGEMENT_RETAKE_ENDPOINT,
    {
      testId: input.testId,
      candidateEmail: input.candidateEmail,
      sendNotification: true,
    }
  );
}
