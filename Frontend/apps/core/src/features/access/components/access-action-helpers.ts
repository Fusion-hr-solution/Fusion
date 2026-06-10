import { ApiError, type AccessProfileSummaryDto, type WorkforceAccessSubjectSummaryDto } from "@repo/api";
import type {
  WorkforceBulkInviteResponseDto,
  WorkforceAccountStatusDto,
} from "@/app/(pages)/employees/employee-roster.types";
import { getSuggestedInviteRole } from "@/features/access/shared/employee-access";

export type EmployeeAccessSheetMode =
  | "invite"
  | "pending"
  | "profile"
  | "review";

export type AccessRowPrimaryActionKind =
  | "view"
  | "invite"
  | "copyInviteLink"
  | "updateProfile"
  | "review";

export type AccessActionErrorContext =
  | "loadDetails"
  | "sendInvite"
  | "bulkInvite"
  | "resendInvite"
  | "copyInviteLink"
  | "updateAccessProfile"
  | "bulkUpdateAccessProfile"
  | "reactivateAccount"
  | "deactivateAccount";

export interface AccessRowPrimaryAction {
  kind: AccessRowPrimaryActionKind;
  label: string;
  mode: EmployeeAccessSheetMode;
}

export interface AggregatedReason {
  reason: string;
  count: number;
}

export interface BulkInviteResultSummary {
  totalRequested: number;
  invitedCount: number;
  refreshedCount: number;
  alreadyActiveCount: number;
  skippedCount: number;
}

interface BulkEligibilityReview {
  eligibleSubjects: WorkforceAccessSubjectSummaryDto[];
  skippedReasons: AggregatedReason[];
}

function aggregateReasons(reasons: string[]): AggregatedReason[] {
  const counts = new Map<string, number>();

  for (const reason of reasons) {
    counts.set(reason, (counts.get(reason) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((left, right) => right.count - left.count || left.reason.localeCompare(right.reason));
}

function getInviteSkippedReason(subject: WorkforceAccessSubjectSummaryDto): string | null {
  switch (subject.provisioningState) {
    case "Unprovisioned":
    case "InviteExpired":
    case "InviteRevoked":
      return null;
    case "InvitePending":
      return "Already has a pending invitation";
    case "Active":
      return "Already has an active account";
    case "Inactive":
      return "Needs review";
    case "InviteAccepted":
      return "Activation is still incomplete";
    case "Conflict":
      return subject.accessStateDetail ?? subject.reviewReason ?? "Needs review";
    default:
      return subject.accessStateDetail ?? subject.reviewReason ?? "Needs review";
  }
}

export function getAccessPrimaryAction(
  subject: WorkforceAccessSubjectSummaryDto,
  canManageAccess: boolean
): AccessRowPrimaryAction {
  if (!canManageAccess) {
    return {
      kind: "view",
      label: "View",
      mode: getSheetModeForSubject(subject),
    };
  }

  switch (subject.accessState) {
    case "NotInvited":
      return { kind: "invite", label: "Send invite", mode: "invite" };
    case "InvitePending":
      return {
        kind: "copyInviteLink",
        label: "Copy invite link",
        mode: "pending",
      };
    case "ActiveAccount":
      return { kind: "updateProfile", label: "Update access profile", mode: "profile" };
    default:
      return { kind: "review", label: "Review issue", mode: "review" };
  }
}

export function canResendInviteFromRow(
  subject: WorkforceAccessSubjectSummaryDto,
  canManageAccess: boolean
): boolean {
  return canManageAccess && subject.accessState === "InvitePending";
}

export function getSheetModeForSubject(
  subject: WorkforceAccessSubjectSummaryDto
): EmployeeAccessSheetMode {
  switch (subject.accessState) {
    case "NotInvited":
      return "invite";
    case "InvitePending":
      return "pending";
    case "ActiveAccount":
      return "profile";
    default:
      return "review";
  }
}

export function resolveSheetModeForAccount(
  account: WorkforceAccountStatusDto | null,
  requestedMode?: EmployeeAccessSheetMode | null,
  hasError = false
): EmployeeAccessSheetMode {
  if (hasError) {
    return "review";
  }

  const defaultMode = getDefaultSheetModeForAccount(account);

  if (!requestedMode) {
    return defaultMode;
  }

  if (!isSheetModeSupported(account, requestedMode)) {
    return defaultMode;
  }

  return requestedMode;
}

function getDefaultSheetModeForAccount(
  account: WorkforceAccountStatusDto | null
): EmployeeAccessSheetMode {
  if (!account || account.provisioningState === "Unprovisioned") {
    return "invite";
  }

  if (account.provisioningState === "InvitePending") {
    return account.accessProfiles.length > 0 ? "pending" : "review";
  }

  if (account.provisioningState === "Active") {
    return "profile";
  }

  return "review";
}

function isSheetModeSupported(
  account: WorkforceAccountStatusDto | null,
  mode: EmployeeAccessSheetMode
): boolean {
  switch (mode) {
    case "invite":
      return !account || account.provisioningState === "Unprovisioned";
    case "pending":
      return account?.provisioningState === "InvitePending";
    case "profile":
      return account?.provisioningState === "Active";
    case "review":
      return true;
    default:
      return false;
  }
}

export function reviewBulkInviteEligibility(
  subjects: WorkforceAccessSubjectSummaryDto[]
): BulkEligibilityReview {
  const eligibleSubjects: WorkforceAccessSubjectSummaryDto[] = [];
  const skippedReasons: string[] = [];

  for (const subject of subjects) {
    const reason = getInviteSkippedReason(subject);
    if (reason) {
      skippedReasons.push(reason);
      continue;
    }

    eligibleSubjects.push(subject);
  }

  return {
    eligibleSubjects,
    skippedReasons: aggregateReasons(skippedReasons),
  };
}

export function getInviteSuccessMessage(
  _account: WorkforceAccountStatusDto
): string {
  return "Invite created.";
}

export function getResendSuccessMessage(
  _account: WorkforceAccountStatusDto
): string {
  return "Invite resent";
}

export function getBulkInviteSuccessMessage(
  response: WorkforceBulkInviteResponseDto
): string {
  if (response.totalRequested === 0) return "No people selected.";

  const parts: string[] = [];
  if (response.invitedCount > 0)
    parts.push(`${response.invitedCount} invited`);
  if (response.refreshedCount > 0)
    parts.push(`${response.refreshedCount} refreshed`);
  if (response.alreadyActiveCount > 0)
    parts.push(`${response.alreadyActiveCount} already active`);

  if (parts.length === 0) return "Already up to date.";

  return parts.join(", ") + ".";
}

export function summarizeBulkInviteResults(
  response: WorkforceBulkInviteResponseDto
): BulkInviteResultSummary {
  return {
    totalRequested: response.totalRequested,
    invitedCount: response.invitedCount,
    refreshedCount: response.refreshedCount,
    alreadyActiveCount: response.alreadyActiveCount,
    skippedCount: response.skippedCount,
  };
}

export function suggestProfileForSubject(
  subject: WorkforceAccessSubjectSummaryDto,
  accessProfiles: AccessProfileSummaryDto[]
): string {
  const suggestedName = getSuggestedInviteRole(subject.directReportCount);
  return (
    accessProfiles.find((profile) => profile.name === suggestedName)?.id ??
    accessProfiles.find((profile) => profile.name === "Employee")?.id ??
    accessProfiles[0]?.id ??
    ""
  );
}

export function summarizeProfileSuggestions(
  subjects: WorkforceAccessSubjectSummaryDto[],
  accessProfiles: AccessProfileSummaryDto[],
  assignments: Record<string, string>
): Array<{ profileName: string; count: number }> {
  const counts = new Map<string, number>();

  for (const subject of subjects) {
    const profileId =
      assignments[subject.employeeId] ??
      suggestProfileForSubject(subject, accessProfiles);
    const profileName =
      accessProfiles.find((p) => p.id === profileId)?.name ?? "Unknown";
    counts.set(profileName, (counts.get(profileName) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([profileName, count]) => ({ profileName, count }))
    .sort((a, b) => b.count - a.count || a.profileName.localeCompare(b.profileName));
}

export function getNeedsReviewReason(
  account: WorkforceAccountStatusDto | null
): string {
  if (!account) {
    return "Review this access record before continuing.";
  }

  if (account.conflict?.message?.trim()) {
    return account.conflict.message;
  }

  if (
    account.provisioningState === "InvitePending" &&
    account.accessProfiles.length === 0
  ) {
    return "Choose an access profile before continuing.";
  }

  switch (account.provisioningState) {
    case "Inactive":
      return "This account is inactive.";
    case "InviteExpired":
      return "The last invitation expired.";
    case "InviteRevoked":
      return "The invitation was revoked.";
    case "InviteAccepted":
      return "The invitation was accepted, but activation is not complete.";
    default:
      return "Review this access record before continuing.";
  }
}

export function getNeedsReviewNextStep(
  account: WorkforceAccountStatusDto | null
): string {
  if (!account) {
    return "Check this access record before continuing.";
  }

  if (account.conflict?.suggestedAction?.trim()) {
    return account.conflict.suggestedAction;
  }

  if (
    account.provisioningState === "InvitePending" &&
    account.accessProfiles.length === 0
  ) {
    return "Choose an access profile before continuing.";
  }

  switch (account.provisioningState) {
    case "Inactive":
      return "Reactivate the account before continuing.";
    case "InviteExpired":
      return "Send a new invitation when you're ready.";
    case "InviteRevoked":
      return "Send a new invitation if this person still needs access.";
    case "InviteAccepted":
      return "Check the linked account before sending a new invitation.";
    default:
      return "Review the current account before continuing.";
  }
}

export function getAccessActionErrorMessage(
  context: AccessActionErrorContext,
  error: unknown
): string {
  const fallback = getFallbackActionErrorMessage(context);

  if (error instanceof ApiError) {
    if (error.status === 401 || error.status === 403) {
      return "You do not have permission to perform this action.";
    }

    const firstError = error.errors[0]?.trim() ?? "";
    const normalized = firstError.toLowerCase();

    if (
      normalized.includes("already linked") ||
      normalized.includes("already registered in another tenant")
    ) {
      return "This email is already linked to another account.";
    }

    if (
      normalized.includes("access profile is required") ||
      normalized.includes("at least one access profile is required")
    ) {
      return context === "sendInvite"
        ? "Select an access profile before continuing."
        : "Select at least one access profile.";
    }

    if (
      normalized.includes("no longer has a valid access profile") ||
      normalized.includes("cannot change access profiles") ||
      normalized.includes("one or more access profiles do not belong")
    ) {
      return context === "sendInvite"
        ? "Access profile is no longer available."
        : "Access profile could not be updated.";
    }

    if (
      normalized.includes("invitation not found") ||
      normalized.includes("account not found")
    ) {
      return fallback;
    }

    return fallback;
  }

  return fallback;
}

function getFallbackActionErrorMessage(
  context: AccessActionErrorContext
): string {
  switch (context) {
    case "loadDetails":
      return "Access details couldn't be loaded.";
    case "sendInvite":
    case "bulkInvite":
      return "Invitation could not be created.";
    case "resendInvite":
      return "Invite could not be resent.";
    case "copyInviteLink":
      return "Invite link could not be copied.";
    case "updateAccessProfile":
    case "bulkUpdateAccessProfile":
      return "Access profile could not be updated.";
    case "reactivateAccount":
      return "Account could not be reactivated.";
    case "deactivateAccount":
      return "Account could not be deactivated.";
    default:
      return "The action could not be completed.";
  }
}
