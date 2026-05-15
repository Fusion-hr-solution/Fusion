import type {
  EmployeeReadinessFilter,
  EmployeeReadinessIssueDto,
  EmployeeReadinessSummaryDto,
} from "./employee-roster.types";

export type EmployeeFixSheet =
  | "identity"
  | "employment"
  | "organization"
  | "reporting"
  | "status";

export const EMPLOYEE_READINESS_FILTER_OPTIONS: Array<{
  value: EmployeeReadinessFilter;
  label: string;
}> = [
  { value: "NeedsAttention", label: "Needs attention" },
  { value: "MissingRequiredField", label: "Missing required info" },
  { value: "MissingOrgUnit", label: "Missing org unit" },
  { value: "NoManagerAssigned", label: "Reporting issue (no manager)" },
  { value: "ManagerInactive", label: "Reporting issue (inactive manager)" },
  { value: "ManagerMissing", label: "Reporting issue (manager missing)" },
];

export function parseEmployeeReadinessFilter(
  value: string | null | undefined
): EmployeeReadinessFilter | undefined {
  if (!value) {
    return undefined;
  }

  return EMPLOYEE_READINESS_FILTER_OPTIONS.some((option) => option.value === value)
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
      return "status";
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