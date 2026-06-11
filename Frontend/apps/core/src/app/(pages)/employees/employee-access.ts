import type {
  EmployeeAccessFilter,
  WorkforceAccountStatusDto,
} from "./employee-roster.types";

export const EMPLOYEE_ACCESS_FILTER_OPTIONS: Array<{
  value: EmployeeAccessFilter;
  label: string;
}> = [
  { value: "NotInvited", label: "Not invited" },
  { value: "Invited", label: "Invited" },
  { value: "AccountActive", label: "Account active" },
  { value: "NeedsReview", label: "Needs review" },
];

export type AccessInviteRole = "Employee" | "Manager";

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
      return "Invited";
    case "InviteExpired":
    case "InviteRevoked":
    case "InviteAccepted":
      return "Needs review";
    case "Active":
      return "Account active";
    case "Inactive":
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
    case "Account active":
      return "default";
    case "Invited":
      return "secondary";
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
    canInvite:
      account.provisioningState === "Unprovisioned" ||
      account.provisioningState === "Inactive" ||
      account.provisioningState === "Conflict",
    canResend: hasPendingInvite || isExpired || isRevoked,
    canCopyInviteLink: hasInviteLink,
    canReactivate: isInactive,
    canDeactivate: isActive,
    inviteLink: account.inviteLink,
    isActive,
    hasPendingInvite,
    hasConflict: isConflict,
    notIncludedReason:
      account.provisioningState === "Active"
        ? "Already active"
        : account.provisioningState === "InviteAccepted"
        ? "Invite already accepted"
        : account.provisioningState === "Inactive"
        ? "Already inactive"
        : account.provisioningState === "Conflict"
        ? account.conflict?.message ?? "Account conflict"
        : null,
  };
}

export function getSuggestedInviteRole(
  directReportCount: number
): AccessInviteRole {
  return directReportCount > 0 ? "Manager" : "Employee";
}

export interface ReviewDrawerRow {
  employee: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    directReportCount: number;
  };
  suggestedRole: AccessInviteRole;
  workforceAccount: WorkforceAccountStatusDto | null;
}

export interface ReviewDrawerRows {
  inviteableRows: ReviewDrawerRow[];
  notIncludedRows: Array<ReviewDrawerRow & { reason: string }>;
}

export function getReviewDrawerRows(
  selectedEmployees: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    directReportCount: number;
    workforceAccount: WorkforceAccountStatusDto | null;
  }>
): ReviewDrawerRows {
  const inviteableRows: ReviewDrawerRow[] = [];
  const notIncludedRows: Array<ReviewDrawerRow & { reason: string }> = [];

  selectedEmployees.forEach((employee) => {
    const eligibility = getInvitationEligibility(employee.workforceAccount);
    const suggestedRole = getSuggestedInviteRole(employee.directReportCount);

    if (eligibility.canInvite || eligibility.canResend) {
      inviteableRows.push({
        employee: {
          id: employee.id,
          firstName: employee.firstName,
          lastName: employee.lastName,
          email: employee.email,
          directReportCount: employee.directReportCount,
        },
        suggestedRole,
        workforceAccount: employee.workforceAccount,
      });
      return;
    }

    const reason =
      eligibility.notIncludedReason ??
      (employee.workforceAccount ? "Not included" : "No action available");

    notIncludedRows.push({
      employee: {
        id: employee.id,
        firstName: employee.firstName,
        lastName: employee.lastName,
        email: employee.email,
        directReportCount: employee.directReportCount,
      },
      suggestedRole,
      workforceAccount: employee.workforceAccount,
      reason,
    });
  });

  return { inviteableRows, notIncludedRows };
}

export interface BulkSelectionSummary {
  readyToInviteCount: number;
  pendingWithLinkCount: number;
  managerSuggestionCount: number;
  notIncludedCount: number;
}

export function getBulkSelectionSummary(
  selectedEmployees: Array<{
    workforceAccount: WorkforceAccountStatusDto | null;
    directReportCount: number;
  }>
): BulkSelectionSummary {
  let readyToInviteCount = 0;
  let pendingWithLinkCount = 0;
  let managerSuggestionCount = 0;
  let notIncludedCount = 0;

  selectedEmployees.forEach((employee) => {
    const eligibility = getInvitationEligibility(employee.workforceAccount);

    if (eligibility.canInvite) {
      readyToInviteCount += 1;
    }

    if (eligibility.hasPendingInvite && eligibility.canCopyInviteLink) {
      pendingWithLinkCount += 1;
    }

    if (
      !employee.workforceAccount ||
      employee.workforceAccount.provisioningState === "Unprovisioned"
    ) {
      if (employee.directReportCount > 0) {
        managerSuggestionCount += 1;
      }
    }

    if (!eligibility.canInvite && !eligibility.canResend) {
      notIncludedCount += 1;
    }
  });

  return {
    readyToInviteCount,
    pendingWithLinkCount,
    managerSuggestionCount,
    notIncludedCount,
  };
}
