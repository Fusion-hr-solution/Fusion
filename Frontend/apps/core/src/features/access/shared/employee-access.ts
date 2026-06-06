import type {
  EmployeeAccessFilter,
  WorkforceAccountStatusDto,
} from "@/app/(pages)/employees/employee-roster.types";

export const EMPLOYEE_ACCESS_FILTER_OPTIONS: Array<{
  value: EmployeeAccessFilter;
  label: string;
}> = [
  { value: "NotInvited", label: "Not invited" },
  { value: "Invited", label: "Invite pending" },
  { value: "AccountActive", label: "Active account" },
  { value: "NeedsReview", label: "Needs review" },
];

export type AccessInviteRole = "Employee" | "Manager";

export type ActionCohort =
  | "NewInvitation"
  | "RefreshInvitation"
  | "PendingInvitation"
  | "InactiveAccount"
  | "Conflict"
  | "AcceptedInvitation"
  | "Active";

export function classifyActionCohort(
  account: WorkforceAccountStatusDto | null
): ActionCohort {
  if (!account) return "NewInvitation";
  switch (account.provisioningState) {
    case "Unprovisioned":
      return "NewInvitation";
    case "InviteExpired":
    case "InviteRevoked":
      return "RefreshInvitation";
    case "InvitePending":
      return "PendingInvitation";
    case "Inactive":
      return "InactiveAccount";
    case "Conflict":
      return "Conflict";
    case "InviteAccepted":
      return "AcceptedInvitation";
    case "Active":
      return "Active";
    default:
      return "Conflict";
  }
}

export function isProvisionableInBulk(cohort: ActionCohort): boolean {
  return cohort === "NewInvitation" || cohort === "RefreshInvitation";
}

export interface InvitationEligibility {
  canInvite: boolean;
  canResend: boolean;
  canCopyInviteLink: boolean;
  canReactivate: boolean;
  canDeactivate: boolean;
  inviteLink: string | null;
  isActive: boolean;
  hasPendingInvite: boolean;
  hasConflict: boolean;
  notIncludedReason: string | null;
  cohort: ActionCohort;
}

export function parseEmployeeAccessFilter(
  rawValue: string | null
): EmployeeAccessFilter | undefined {
  if (!rawValue) {
    return undefined;
  }

  return EMPLOYEE_ACCESS_FILTER_OPTIONS.find(
    (option) => option.value === rawValue
  )?.value;
}

export function getAccessDisplayState(
  account: WorkforceAccountStatusDto | null
): string {
  if (!account) {
    return "Not invited";
  }

  switch (account.provisioningState) {
    case "Unprovisioned":
      return "Not invited";
    case "InvitePending":
      return "Invite pending";
    case "InviteExpired":
    case "InviteRevoked":
    case "InviteAccepted":
      return "Needs review";
    case "Active":
      return "Active account";
    case "Inactive":
      return "Inactive account";
    case "Conflict":
      return "Needs review";
    default:
      return "Needs review";
  }
}

export function getAccessBadgeTone(
  accessState: string
): "default" | "secondary" | "destructive" | "outline" {
  switch (accessState) {
    case "Active account":
      return "default";
    case "Invite pending":
      return "secondary";
    case "Inactive account":
      return "destructive";
    case "Needs review":
      return "destructive";
    case "Not invited":
    default:
      return "outline";
  }
}

export function matchesEmployeeAccessFilter(
  account: WorkforceAccountStatusDto | null,
  access: EmployeeAccessFilter | undefined
): boolean {
  if (!access) {
    return true;
  }

  if (!account) {
    return access === "NotInvited";
  }

  switch (access) {
    case "NotInvited":
      return account.provisioningState === "Unprovisioned";
    case "Invited":
      return account.provisioningState === "InvitePending";
    case "AccountActive":
      return account.provisioningState === "Active";
    case "NeedsReview":
      return (
        account.provisioningState === "InviteAccepted" ||
        account.provisioningState === "InviteExpired" ||
        account.provisioningState === "InviteRevoked" ||
        account.provisioningState === "Inactive" ||
        account.provisioningState === "Conflict"
      );
    default:
      return false;
  }
}

export function getInvitationEligibility(
  account: WorkforceAccountStatusDto | null
): InvitationEligibility {
  if (!account) {
    return {
      canInvite: true,
      canResend: false,
      canCopyInviteLink: false,
      canReactivate: false,
      canDeactivate: false,
      inviteLink: null,
      isActive: false,
      hasPendingInvite: false,
      hasConflict: false,
      notIncludedReason: null,
      cohort: "NewInvitation" as ActionCohort,
    };
  }

  const hasInviteLink = !!account.inviteLink;
  const hasPendingInvite = account.provisioningState === "InvitePending";
  const isActive = account.provisioningState === "Active";
  const isInactive = account.provisioningState === "Inactive";
  const isConflict = account.provisioningState === "Conflict";
  const isExpired = account.provisioningState === "InviteExpired";
  const isRevoked = account.provisioningState === "InviteRevoked";

  return {
    canInvite: account.provisioningState === "Unprovisioned",
    canResend: hasPendingInvite || isExpired || isRevoked,
    canCopyInviteLink: hasInviteLink,
    canReactivate: isInactive,
    canDeactivate: isActive,
    inviteLink: account.inviteLink,
    isActive,
    hasPendingInvite,
    hasConflict: isConflict,
    cohort: classifyActionCohort(account),
    notIncludedReason:
      account.provisioningState === "Active"
        ? "Already active"
        : account.provisioningState === "InviteAccepted"
          ? "Invitation already accepted"
          : account.provisioningState === "Inactive"
            ? "Account inactive"
            : account.provisioningState === "Conflict"
              ? (account.conflict?.message ?? "Account conflict")
              : null,
  };
}

export function getSuggestedInviteRole(
  directReportCount: number
): AccessInviteRole {
  return directReportCount > 0 ? "Manager" : "Employee";
}
