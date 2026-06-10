import type {
  EmployeeAccessFilter,
  WorkforceAccountProvisioningState,
  WorkforceAccountStatusDto,
} from "./employee-roster.types";

type AccessBadgeTone = "default" | "secondary" | "outline" | "destructive";

export type AccessDisplayState =
  | "Not invited"
  | "Invite pending"
  | "Invite expired"
  | "Invite revoked"
  | "Account active"
  | "Account inactive"
  | "Access conflict";

export type AccessInviteRole = "Employee" | "Manager";

export interface InvitationEligibility {
  canInvite: boolean;
  canResend: boolean;
  canCopyInviteLink: boolean;
  canDeactivate: boolean;
  canReactivate: boolean;
  inviteLink: string | null;
  accountState: WorkforceAccountProvisioningState;
  inviteState:
    | "NotInvited"
    | "Pending"
    | "Expired"
    | "Revoked"
    | "Accepted"
    | null;
  deliveryState: WorkforceAccountStatusDto["deliveryStatus"];
  conflictKind:
    | NonNullable<WorkforceAccountStatusDto["conflict"]>["kind"]
    | null;
  conflictMessage: string | null;
  notIncludedReason: string | null;
}

type SelectionSummaryRow = {
  directReportCount: number;
  workforceAccount: WorkforceAccountStatusDto | null;
};

export interface BulkSelectionSummary {
  selectedCount: number;
  readyToInviteCount: number;
  managerSuggestionCount: number;
  pendingCount: number;
  activeCount: number;
  inactiveCount: number;
  conflictCount: number;
  pendingWithLinkCount: number;
  notIncludedCount: number;
  hasInviteReadyRows: boolean;
  hasOnlyPendingRows: boolean;
}

export interface ReviewDrawerInviteableRow<TRow> {
  employee: TRow;
  suggestedRole: AccessInviteRole;
}

export interface ReviewDrawerNotIncludedRow<TRow> {
  employee: TRow;
  reason: string;
}

export interface ReviewDrawerRows<TRow> {
  inviteableRows: ReviewDrawerInviteableRow<TRow>[];
  notIncludedRows: ReviewDrawerNotIncludedRow<TRow>[];
}

export const EMPLOYEE_ACCESS_FILTER_OPTIONS: Array<{
  value: EmployeeAccessFilter;
  label: string;
}> = [
  { value: "NeedsAccess", label: "Not invited" },
  { value: "InvitePending", label: "Invite pending" },
  { value: "AccountActive", label: "Account active" },
  { value: "AccountInactive", label: "Account inactive" },
  { value: "Conflict", label: "Access conflict" },
  { value: "InviteExpired", label: "Invite expired" },
  { value: "InviteRevoked", label: "Invite revoked" },
];

const ACCESS_FILTER_VALUES = new Set<EmployeeAccessFilter>(
  EMPLOYEE_ACCESS_FILTER_OPTIONS.map((option) => option.value)
);

export function parseEmployeeAccessFilter(
  value: string | null
): EmployeeAccessFilter | undefined {
  if (!value) {
    return undefined;
  }

  return ACCESS_FILTER_VALUES.has(value as EmployeeAccessFilter)
    ? (value as EmployeeAccessFilter)
    : undefined;
}

export function canStartEmployeeAccess(
  account: WorkforceAccountStatusDto | null
): boolean {
  if (!account) {
    return true;
  }

  return (
    account.provisioningState === "Unprovisioned" ||
    account.provisioningState === "InviteExpired" ||
    account.provisioningState === "InviteRevoked"
  );
}

export function getSuggestedInviteRole(
  directReportCount: number
): AccessInviteRole {
  return directReportCount > 0 ? "Manager" : "Employee";
}

export function getAccessDisplayState(
  account: WorkforceAccountStatusDto | null
): AccessDisplayState {
  if (!account || account.provisioningState === "Unprovisioned") {
    return "Not invited";
  }

  switch (account.provisioningState) {
    case "InvitePending":
      return "Invite pending";
    case "InviteExpired":
      return "Invite expired";
    case "InviteRevoked":
      return "Invite revoked";
    case "Active":
    case "InviteAccepted":
      return "Account active";
    case "Inactive":
      return "Account inactive";
    case "Conflict":
      return "Access conflict";
    default:
      return "Not invited";
  }
}

export function getAccessBadgeTone(state: AccessDisplayState): AccessBadgeTone {
  switch (state) {
    case "Account active":
      return "default";
    case "Account inactive":
    case "Invite revoked":
      return "secondary";
    case "Access conflict":
      return "destructive";
    default:
      return "outline";
  }
}

export function needsFallbackInviteLink(
  account: WorkforceAccountStatusDto | null
): boolean {
  if (!account?.inviteLink || account.provisioningState !== "InvitePending") {
    return false;
  }

  return (
    account.deliveryStatus === "Failed" ||
    account.deliveryStatus === "NotAttempted" ||
    account.deliveryStatus === "Suppressed" ||
    account.deliveryStatus === "Skipped"
  );
}

function getInviteState(
  account: WorkforceAccountStatusDto | null
): InvitationEligibility["inviteState"] {
  if (!account) {
    return "NotInvited";
  }

  switch (account.provisioningState) {
    case "InvitePending":
      return "Pending";
    case "InviteExpired":
      return "Expired";
    case "InviteRevoked":
      return "Revoked";
    case "InviteAccepted":
      return "Accepted";
    case "Unprovisioned":
      return "NotInvited";
    default:
      return null;
  }
}

function getNotIncludedReason(
  account: WorkforceAccountStatusDto | null
): string | null {
  if (!account || canStartEmployeeAccess(account)) {
    return null;
  }

  switch (account.provisioningState) {
    case "InvitePending":
      return "Already invited";
    case "InviteAccepted":
    case "Active":
      return "Already active";
    case "Inactive":
      return "Account inactive";
    case "Conflict":
      return "Access conflict";
    default:
      return "Not included";
  }
}

export function getInvitationEligibility(
  account: WorkforceAccountStatusDto | null
): InvitationEligibility {
  const accountState = account?.provisioningState ?? "Unprovisioned";
  const hasConflict = !!account?.conflict;

  return {
    canInvite:
      !hasConflict &&
      (accountState === "Unprovisioned" ||
        accountState === "InviteExpired" ||
        accountState === "InviteRevoked"),
    canResend:
      !hasConflict &&
      (accountState === "InvitePending" || accountState === "InviteExpired"),
    canCopyInviteLink: !!account?.inviteLink,
    canDeactivate: !hasConflict && accountState === "Active",
    canReactivate: !hasConflict && accountState === "Inactive",
    inviteLink: account?.inviteLink ?? null,
    accountState,
    inviteState: getInviteState(account),
    deliveryState: account?.deliveryStatus ?? null,
    conflictKind: account?.conflict?.kind ?? null,
    conflictMessage: account?.conflict?.message ?? null,
    notIncludedReason: getNotIncludedReason(account),
  };
}

export function getBulkSelectionSummary(
  employees: SelectionSummaryRow[]
): BulkSelectionSummary {
  let readyToInviteCount = 0;
  let managerSuggestionCount = 0;
  let pendingCount = 0;
  let activeCount = 0;
  let inactiveCount = 0;
  let conflictCount = 0;
  let pendingWithLinkCount = 0;

  for (const employee of employees) {
    const eligibility = getInvitationEligibility(employee.workforceAccount);
    const accountState = eligibility.accountState;

    if (eligibility.canInvite) {
      readyToInviteCount += 1;
      if (employee.directReportCount > 0) {
        managerSuggestionCount += 1;
      }
    }

    if (accountState === "InvitePending") {
      pendingCount += 1;
    } else if (accountState === "Active" || accountState === "InviteAccepted") {
      activeCount += 1;
    } else if (accountState === "Inactive") {
      inactiveCount += 1;
    } else if (accountState === "Conflict") {
      conflictCount += 1;
    }

    if (accountState === "InvitePending" && eligibility.canCopyInviteLink) {
      pendingWithLinkCount += 1;
    }
  }

  const selectedCount = employees.length;
  const notIncludedCount = selectedCount - readyToInviteCount;

  return {
    selectedCount,
    readyToInviteCount,
    managerSuggestionCount,
    pendingCount,
    activeCount,
    inactiveCount,
    conflictCount,
    pendingWithLinkCount,
    notIncludedCount,
    hasInviteReadyRows: readyToInviteCount > 0,
    hasOnlyPendingRows: selectedCount > 0 && pendingCount === selectedCount,
  };
}

export function getReviewDrawerRows<TRow extends SelectionSummaryRow>(
  employees: TRow[]
): ReviewDrawerRows<TRow> {
  const inviteableRows: ReviewDrawerInviteableRow<TRow>[] = [];
  const notIncludedRows: ReviewDrawerNotIncludedRow<TRow>[] = [];

  for (const employee of employees) {
    const eligibility = getInvitationEligibility(employee.workforceAccount);

    if (eligibility.canInvite) {
      inviteableRows.push({
        employee,
        suggestedRole: getSuggestedInviteRole(employee.directReportCount),
      });
      continue;
    }

    notIncludedRows.push({
      employee,
      reason: eligibility.notIncludedReason ?? "Not included",
    });
  }

  return {
    inviteableRows,
    notIncludedRows,
  };
}

export function matchesEmployeeAccessFilter(
  account: WorkforceAccountStatusDto | null,
  filter: EmployeeAccessFilter
): boolean {
  switch (filter) {
    case "NeedsAccess":
      return canStartEmployeeAccess(account);
    case "InvitePending":
      return account?.provisioningState === "InvitePending";
    case "AccountActive":
      return (
        account?.provisioningState === "Active" ||
        account?.provisioningState === "InviteAccepted"
      );
    case "AccountInactive":
      return account?.provisioningState === "Inactive";
    case "Conflict":
      return account?.provisioningState === "Conflict";
    case "InviteExpired":
      return account?.provisioningState === "InviteExpired";
    case "InviteRevoked":
      return account?.provisioningState === "InviteRevoked";
    default:
      return false;
  }
}
