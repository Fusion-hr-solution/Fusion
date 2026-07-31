import { createPlatformApiClient } from "@repo/api";
import type {
  CandidateInvitation,
  CandidateProgressTimeline,
  CandidateLinkSecurityState,
  CandidateTimelineCandidate,
  CandidateManagementOverview,
  CandidateAttemptSettings,
  CandidatePrivacyActionResult,
  CandidateRetentionState,
  CandidateRetentionSettings,
  CandidateRetentionRun,
  RetentionAction,
} from "@/types";
import type {
  BackendCandidateManagementOverviewDto,
  BackendCandidateInvitationDto,
  InviteCandidateInput,
  BackendCandidateLinkSecurityStateDto,
  BackendCandidateAttemptSettingsDto,
  BackendCandidatePrivacyActionResultDto,
  CandidatePrivacyActionInput,
  CandidatePrivacyActionBatchInput,
  SaveCandidateAttemptSettingsInput,
  SaveCandidateLinkSecurityInput,
  BackendCandidateTimelineCandidateDto,
  BackendCandidateProgressTimelineDto,
  BackendCandidateRetakeGrantResultDto,
  GrantCandidateRetakeInput,
  BackendCandidateRetentionStateDto,
  BackendCandidateRetentionSettingsDto,
  BackendCandidateRetentionRunDto,
  SaveCandidateRetentionSettingsInput,
  RunCandidateRetentionInput,
} from "./models/candidate-management-models";

const client = createPlatformApiClient();

const CANDIDATE_INVITATIONS_API = "/interview/candidates/invitations";
const CANDIDATE_MANAGEMENT_API = "/interview/candidates/management";

const CANDIDATE_INVITATIONS_PENDING_ENDPOINT = `${CANDIDATE_INVITATIONS_API}/pending`;
const CANDIDATE_INVITATIONS_BULK_ENDPOINT = `${CANDIDATE_INVITATIONS_API}/bulk`;

const CANDIDATE_MANAGEMENT_OVERVIEW_PATH = "/overview";
const CANDIDATE_MANAGEMENT_ATTEMPT_SETTINGS_PATH = "/attempt-settings";
const CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_PATH = "/privacy-actions";
const CANDIDATE_MANAGEMENT_LINK_SECURITY_PATH = "/link-security";
const CANDIDATE_MANAGEMENT_TIMELINE_PATH = "/timeline";

const CANDIDATE_MANAGEMENT_OVERVIEW_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_OVERVIEW_PATH}`;
const CANDIDATE_MANAGEMENT_ATTEMPT_SETTINGS_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_ATTEMPT_SETTINGS_PATH}`;
const CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_PATH}`;
const CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_BATCH_ENDPOINT = `${CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_ENDPOINT}/batch`;
const CANDIDATE_MANAGEMENT_LINK_SECURITY_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_LINK_SECURITY_PATH}`;
const CANDIDATE_MANAGEMENT_TIMELINE_CANDIDATES_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_TIMELINE_PATH}/candidates`;
const CANDIDATE_MANAGEMENT_TIMELINE_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}${CANDIDATE_MANAGEMENT_TIMELINE_PATH}`;
const CANDIDATE_MANAGEMENT_RETAKE_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}/retake`;
const CANDIDATE_MANAGEMENT_RETENTION_ENDPOINT = `${CANDIDATE_MANAGEMENT_API}/retention`;

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

function mapAttemptSettings(dto: BackendCandidateAttemptSettingsDto): CandidateAttemptSettings {
  return {
    defaultMaxAttempts: dto.defaultMaxAttempts,
  };
}

function mapPrivacyAction(dto: BackendCandidatePrivacyActionResultDto): CandidatePrivacyActionResult {
  return {
    action: dto.action,
    testId: dto.testId,
    adminId: dto.adminId,
    triggerSource: dto.triggerSource,
    candidateAliasEmail: dto.candidateAliasEmail,
    candidateAliasName: dto.candidateAliasName,
    candidateEmailHash: dto.candidateEmailHash,
    invitationIds: dto.invitationIds,
    invitationsUpdated: dto.invitationsUpdated,
    attemptsUpdated: dto.attemptsUpdated,
    eventsUpdated: dto.eventsUpdated,
    loggedAtUtc: dto.loggedAtUtc,
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
      gradingStatus: attempt.gradingStatus ?? "Pending",
      totalScore: attempt.totalScore,
      maxScore: attempt.maxScore,
      milestones: attempt.milestones.map((milestone) => ({
        name: milestone.name,
        state: milestone.state,
        occurredAtUtc: milestone.occurredAtUtc,
      })),
      proctoring: attempt.proctoring
        ? {
            enabled: attempt.proctoring.enabled,
            totalEvents: attempt.proctoring.totalEvents,
            severity: attempt.proctoring.severity,
            countsByType: attempt.proctoring.countsByType.map((item) => ({
              type: item.type,
              count: item.count,
              severity: item.severity,
            })),
            firstEventAtUtc: attempt.proctoring.firstEventAtUtc,
            lastEventAtUtc: attempt.proctoring.lastEventAtUtc,
            lastHeartbeatAtUtc: attempt.proctoring.lastHeartbeatAtUtc,
            heartbeatGapSeconds: attempt.proctoring.heartbeatGapSeconds,
            wentDark: attempt.proctoring.wentDark,
          }
        : undefined,
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

export async function getCandidateAttemptSettings(): Promise<CandidateAttemptSettings> {
  const dto = await client.get<BackendCandidateAttemptSettingsDto>(
    CANDIDATE_MANAGEMENT_ATTEMPT_SETTINGS_ENDPOINT
  );

  return mapAttemptSettings(dto);
}

export async function saveCandidateAttemptSettings(
  input: SaveCandidateAttemptSettingsInput
): Promise<CandidateAttemptSettings> {
  const dto = await client.put<BackendCandidateAttemptSettingsDto>(
    CANDIDATE_MANAGEMENT_ATTEMPT_SETTINGS_ENDPOINT,
    {
      defaultMaxAttempts: input.defaultMaxAttempts,
    }
  );

  return mapAttemptSettings(dto);
}

export async function applyCandidatePrivacyAction(
  input: CandidatePrivacyActionInput
): Promise<CandidatePrivacyActionResult> {
  const dto = await client.post<BackendCandidatePrivacyActionResultDto>(
    CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_ENDPOINT,
    {
      testId: input.testId,
      candidateEmail: input.candidateEmail,
      invitationId: input.invitationId,
      action: input.action,
      adminId: input.adminId,
      triggerSource: input.triggerSource ?? "UI",
    }
  );

  return mapPrivacyAction(dto);
}

export async function applyCandidatePrivacyActionBatch(
  input: CandidatePrivacyActionBatchInput
): Promise<CandidatePrivacyActionResult[]> {
  const dto = await client.post<BackendCandidatePrivacyActionResultDto[]>(
    CANDIDATE_MANAGEMENT_PRIVACY_ACTIONS_BATCH_ENDPOINT,
    {
      testId: input.testId,
      candidateEmails: input.candidateEmails,
      invitationIds: input.invitationIds,
      action: input.action,
      adminId: input.adminId,
      triggerSource: input.triggerSource ?? "UI",
    }
  );

  return dto.map(mapPrivacyAction);
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

export async function deleteInvitation(invitationId: string): Promise<void> {
  await client.delete(
    `${CANDIDATE_INVITATIONS_API}/${encodeURIComponent(invitationId)}`
  );
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

function parseRetentionAction(value: string): RetentionAction {
  if (value === "Anonymize" || value === "Delete" || value === "Expire") return value;
  return "Anonymize";
}

function mapRetentionSettings(dto: BackendCandidateRetentionSettingsDto): CandidateRetentionSettings {
  return {
    enabled: dto.enabled,
    retentionAction: parseRetentionAction(dto.retentionAction),
    retentionPeriodDays: dto.retentionPeriodDays,
    scanIntervalHours: dto.scanIntervalHours,
    lastRunAtUtc: dto.lastRunAtUtc,
  };
}

function mapRetentionRun(dto: BackendCandidateRetentionRunDto): CandidateRetentionRun {
  return {
    id: dto.id,
    triggeredBy: dto.triggeredBy,
    triggerSource: dto.triggerSource,
    retentionAction: parseRetentionAction(dto.retentionAction),
    retentionPeriodDays: dto.retentionPeriodDays,
    candidatesScanned: dto.candidatesScanned,
    candidatesProcessed: dto.candidatesProcessed,
    candidatesAnonymized: dto.candidatesAnonymized,
    candidatesDeleted: dto.candidatesDeleted,
    candidatesExpired: dto.candidatesExpired,
    startedAtUtc: dto.startedAtUtc,
    completedAtUtc: dto.completedAtUtc,
  };
}

export async function getCandidateRetentionState(): Promise<CandidateRetentionState> {
  const dto = await client.get<BackendCandidateRetentionStateDto>(
    CANDIDATE_MANAGEMENT_RETENTION_ENDPOINT
  );

  return {
    settings: mapRetentionSettings(dto.settings),
    pendingCount: dto.pendingCount,
    recentRuns: dto.recentRuns.map(mapRetentionRun),
  };
}

export async function saveCandidateRetentionSettings(
  input: SaveCandidateRetentionSettingsInput
): Promise<CandidateRetentionSettings> {
  const dto = await client.put<BackendCandidateRetentionSettingsDto>(
    CANDIDATE_MANAGEMENT_RETENTION_ENDPOINT,
    {
      enabled: input.enabled,
      retentionAction: input.retentionAction,
      retentionPeriodDays: input.retentionPeriodDays,
      scanIntervalHours: input.scanIntervalHours,
    }
  );

  return mapRetentionSettings(dto);
}

export async function runCandidateRetention(
  input: RunCandidateRetentionInput
): Promise<CandidateRetentionRun> {
  const dto = await client.post<BackendCandidateRetentionRunDto>(
    `${CANDIDATE_MANAGEMENT_RETENTION_ENDPOINT}/run`,
    { triggeredBy: input.triggeredBy }
  );

  return mapRetentionRun(dto);
}
