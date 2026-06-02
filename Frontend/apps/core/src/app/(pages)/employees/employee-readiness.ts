import type {
  EmployeeReadinessFilter,
  EmployeeReadinessIssueDto,
  EmployeeReadinessSummaryDto,
} from "./employee-roster.types";

export type EmployeeFixSheet =
  | "identity"
  | "employment"
  | "organization"
  | "reporting";

export const EMPLOYEE_READINESS_FILTER_OPTIONS: Array<{
  value: EmployeeReadinessFilter;
  label: string;
}> = [
  { value: "Ready", label: "Complete records" },
  { value: "NeedsAttention", label: "Incomplete records" },
];

const REPORTING_ISSUE_CODES = new Set<EmployeeReadinessIssueDto["code"]>([
  "NoManagerAssigned",
  "ManagerInactive",
  "ManagerMissing",
]);

export interface EmployeeReadinessStateMeta {
  label: string;
  variant: "destructive" | "secondary" | "outline";
}

export function parseEmployeeReadinessFilter(
  value: string | null | undefined
): EmployeeReadinessFilter | undefined {
  if (!value) {
    return undefined;
  }

  if (
    value === "NoManagerAssigned" ||
    value === "ManagerInactive" ||
    value === "ManagerMissing"
  ) {
    return "ReportingIssue";
  }

  if (value === "DeactivationBlocked") {
    return "DeactivationBlocked";
  }

  return EMPLOYEE_READINESS_FILTER_OPTIONS.some(
    (option) => option.value === value
  )
    ? (value as EmployeeReadinessFilter)
    : undefined;
}

export function getEmployeeActionIssues(
  readiness: EmployeeReadinessSummaryDto | null | undefined
): EmployeeReadinessIssueDto[] {
  if (!readiness) {
    return [];
  }

  return [...readiness.employeeStateIssues];
}

export function getEmployeeBlockingIssues(
  readiness: EmployeeReadinessSummaryDto | null | undefined
): EmployeeReadinessIssueDto[] {
  if (!readiness) {
    return [];
  }

  return [...readiness.blockingIssues];
}

export function getEmployeeReadinessIssues(
  readiness: EmployeeReadinessSummaryDto | null | undefined
): EmployeeReadinessIssueDto[] {
  return [
    ...getEmployeeActionIssues(readiness),
    ...getEmployeeBlockingIssues(readiness),
  ];
}

export function getEmployeeReadinessBadgeLabel(
  issue: EmployeeReadinessIssueDto
): string {
  switch (issue.code) {
    case "MissingRequiredField":
      return issue.fieldKey === "jobTitle"
        ? "Missing job title"
        : "Missing required field";
    case "MissingOrgUnit":
      return "Missing org unit";
    case "NoManagerAssigned":
      return "No manager";
    case "ManagerInactive":
      return "Manager inactive";
    case "ManagerMissing":
      return "Manager missing";
    case "DeactivationBlocked":
      return "Deactivation blocked";
    default:
      return issue.label;
  }
}

export function getEmployeeReadinessBadgeVariant(
  issue: EmployeeReadinessIssueDto
): "destructive" | "secondary" | "outline" {
  if (issue.severity === "Blocker") {
    return "destructive";
  }

  switch (issue.code) {
    case "ManagerInactive":
    case "ManagerMissing":
      return "destructive";
    case "MissingRequiredField":
    case "MissingOrgUnit":
    case "NoManagerAssigned":
      return "secondary";
    default:
      return "outline";
  }
}

export function getEmployeeReadinessStateMeta(
  readiness: EmployeeReadinessSummaryDto | null | undefined
): EmployeeReadinessStateMeta {
  const actionIssues = getEmployeeActionIssues(readiness);
  const blockingIssues = getEmployeeBlockingIssues(readiness);
  const issueCodes = new Set(
    [...actionIssues, ...blockingIssues].map((issue) => issue.code)
  );

  if (issueCodes.has("DeactivationBlocked")) {
    return { label: "Has direct reports", variant: "outline" };
  }

  if (issueCodes.size === 0) {
    return { label: "Ready", variant: "outline" };
  }

  if (issueCodes.size === 1 && issueCodes.has("MissingRequiredField")) {
    return { label: "Missing required info", variant: "secondary" };
  }

  if (issueCodes.size === 1 && issueCodes.has("MissingOrgUnit")) {
    return { label: "Missing org unit", variant: "secondary" };
  }

  if (issueCodes.has("ManagerInactive")) {
    return { label: "Manager inactive", variant: "destructive" };
  }

  if (issueCodes.has("ManagerMissing")) {
    return { label: "Manager missing", variant: "destructive" };
  }

  if ([...issueCodes].every((code) => REPORTING_ISSUE_CODES.has(code))) {
    return { label: "Manager issue", variant: "destructive" };
  }

  return { label: "Has issues", variant: "secondary" };
}

export function getEmployeeFixSheet(
  issue: EmployeeReadinessIssueDto
): EmployeeFixSheet | null {
  switch (issue.fixTarget.kind) {
    case "ProfileIdentity":
      return "identity";
    case "ProfileEmployment":
      return "employment";
    case "ProfileOrganization":
      return "organization";
    case "ReportingRelationships":
      return "reporting";
    case "ProfileStatus":
      return null;
    default:
      return null;
  }
}

export function buildEmployeeFixHref(
  issue: EmployeeReadinessIssueDto
): string | null {
  const employeeId = issue.fixTarget.employeeId;
  const sheet = getEmployeeFixSheet(issue);

  if (!employeeId || !sheet) {
    return null;
  }

  const params = new URLSearchParams({ sheet });
  return `/employees/${employeeId}?${params.toString()}`;
}

export function buildImportHistoryHref(historyId?: string | null): string {
  if (!historyId) {
    return "/employees/import#employee-import-history";
  }

  return `/employees/import?historyId=${historyId}#employee-import-history`;
}
