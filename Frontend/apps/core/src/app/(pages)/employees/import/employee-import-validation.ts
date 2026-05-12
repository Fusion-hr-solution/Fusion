import type {
  EmployeeImportIssueCategory,
  EmployeeImportSessionDto,
  EmployeeImportValidationIssueDto,
} from "./employee-import.types";

const FIELD_LABELS: Record<string, string> = {
  firstName: "First name",
  lastName: "Last name",
  email: "Email",
  hireDate: "Hire date",
  jobTitle: "Job title",
  orgUnitCode: "Org unit code",
  managerEmail: "Manager email",
};

const CATEGORY_LABELS: Record<EmployeeImportIssueCategory, string> = {
  missingRequiredData: "Missing required data",
  invalidFormat: "Invalid format",
  duplicateIdentity: "Duplicate identity",
  invalidStructureReference: "Invalid structure reference",
  invalidReportingReference: "Invalid reporting reference",
  invalidRelationship: "Invalid relationship",
};

const CATEGORY_ORDER: Record<EmployeeImportIssueCategory, number> = {
  missingRequiredData: 0,
  invalidFormat: 1,
  duplicateIdentity: 2,
  invalidStructureReference: 3,
  invalidReportingReference: 4,
  invalidRelationship: 5,
};

export type EmployeeImportIssueGroupRow = {
  rowNumber: number;
  label: string;
  details: string[];
  inPreview: boolean;
};

export type EmployeeImportIssueGroup = {
  key: string;
  category: EmployeeImportIssueCategory;
  categoryLabel: string;
  title: string;
  shortLabel: string;
  valueLabel: string | null;
  value: string | null;
  fieldKeys: string[];
  rowNumbers: number[];
  previewRowNumbers: number[];
  previewHiddenRowCount: number;
  issueCount: number;
  fixHint: string;
  rows: EmployeeImportIssueGroupRow[];
};

export type EmployeeImportValidationUiModel = {
  rowContextByNumber: Map<number, string>;
  groupedIssues: EmployeeImportIssueGroup[];
  groupsByRowNumber: Map<number, EmployeeImportIssueGroup[]>;
  rawIssueCount: number;
  groupCount: number;
  affectedRowCount: number;
  rowsOutsidePreviewCount: number;
  categorySummary: Array<{
    category: EmployeeImportIssueCategory;
    label: string;
    count: number;
  }>;
};

export function buildEmployeeImportValidationUiModel(
  session: EmployeeImportSessionDto
): EmployeeImportValidationUiModel {
  const rowContextByNumber = buildRowContextByNumber(session);
  const previewRowNumbers = new Set(
    session.previewRows.map((row) => row.rowNumber)
  );
  const groupedIssueEntries = Array.from(
    groupIssues(session.validationIssues).entries()
  )
    .map(([key, issues]) =>
      buildIssueGroup(key, issues, rowContextByNumber, previewRowNumbers)
    )
    .sort((left, right) => {
      const categoryDifference =
        CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category];

      if (categoryDifference !== 0) {
        return categoryDifference;
      }

      const leftFirstRow = left.rowNumbers[0] ?? Number.MAX_SAFE_INTEGER;
      const rightFirstRow = right.rowNumbers[0] ?? Number.MAX_SAFE_INTEGER;
      if (leftFirstRow !== rightFirstRow) {
        return leftFirstRow - rightFirstRow;
      }

      return left.title.localeCompare(right.title);
    });

  const groupsByRowNumber = new Map<number, EmployeeImportIssueGroup[]>();
  for (const group of groupedIssueEntries) {
    for (const rowNumber of group.rowNumbers) {
      const existingGroups = groupsByRowNumber.get(rowNumber) ?? [];
      existingGroups.push(group);
      groupsByRowNumber.set(rowNumber, existingGroups);
    }
  }

  const affectedRows = new Set(
    session.validationIssues.map((issue) => issue.rowNumber)
  );
  const categoryCounts = new Map<EmployeeImportIssueCategory, number>();
  for (const group of groupedIssueEntries) {
    categoryCounts.set(
      group.category,
      (categoryCounts.get(group.category) ?? 0) + 1
    );
  }

  const categorySummary = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({
      category,
      count,
      label: CATEGORY_LABELS[category],
    }))
    .sort(
      (left, right) =>
        CATEGORY_ORDER[left.category] - CATEGORY_ORDER[right.category]
    );

  const rowsOutsidePreviewCount = Array.from(affectedRows).filter(
    (rowNumber) => !previewRowNumbers.has(rowNumber)
  ).length;

  return {
    rowContextByNumber,
    groupedIssues: groupedIssueEntries,
    groupsByRowNumber,
    rawIssueCount: session.validationIssues.length,
    groupCount: groupedIssueEntries.length,
    affectedRowCount: affectedRows.size,
    rowsOutsidePreviewCount,
    categorySummary,
  };
}

function buildRowContextByNumber(session: EmployeeImportSessionDto) {
  const rowContextByNumber = new Map<number, string>();

  for (const row of session.previewRows) {
    const label =
      row.email ??
      [row.firstName, row.lastName].filter(Boolean).join(" ").trim();

    if (label) {
      rowContextByNumber.set(row.rowNumber, label);
    }
  }

  for (const row of session.sampleRows) {
    if (rowContextByNumber.has(row.rowNumber)) {
      continue;
    }

    const label =
      row.values.email ??
      [row.values.firstName, row.values.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

    if (label) {
      rowContextByNumber.set(row.rowNumber, label);
    }
  }

  return rowContextByNumber;
}

function groupIssues(issues: EmployeeImportValidationIssueDto[]) {
  const groupedIssues = new Map<string, EmployeeImportValidationIssueDto[]>();

  for (const issue of issues) {
    const grouped = groupedIssues.get(issue.groupKey) ?? [];
    grouped.push(issue);
    groupedIssues.set(issue.groupKey, grouped);
  }

  return groupedIssues;
}

function buildIssueGroup(
  key: string,
  issues: EmployeeImportValidationIssueDto[],
  rowContextByNumber: Map<number, string>,
  previewRowNumbers: Set<number>
): EmployeeImportIssueGroup {
  const sortedIssues = [...issues].sort(
    (left, right) => left.rowNumber - right.rowNumber
  );
  const primaryIssue = sortedIssues[0]!;
  const rowNumbers = Array.from(
    new Set(sortedIssues.map((issue) => issue.rowNumber))
  ).sort((left, right) => left - right);
  const fieldKeys = Array.from(
    new Set(
      sortedIssues
        .map((issue) => issue.field)
        .filter((field): field is string => !!field)
    )
  );
  const previewRows = rowNumbers.filter((rowNumber) =>
    previewRowNumbers.has(rowNumber)
  );
  const codes = Array.from(new Set(sortedIssues.map((issue) => issue.code)));

  return {
    key,
    category: primaryIssue.category,
    categoryLabel: CATEGORY_LABELS[primaryIssue.category],
    title: getGroupTitle(primaryIssue, codes.length),
    shortLabel: getGroupShortLabel(primaryIssue),
    valueLabel: getGroupValueLabel(primaryIssue),
    value: primaryIssue.value,
    fieldKeys,
    rowNumbers,
    previewRowNumbers: previewRows,
    previewHiddenRowCount: rowNumbers.length - previewRows.length,
    issueCount: sortedIssues.length,
    fixHint: primaryIssue.fixHint,
    rows: rowNumbers.map((rowNumber) => {
      const rowIssues = sortedIssues.filter(
        (issue) => issue.rowNumber === rowNumber
      );

      return {
        rowNumber,
        label: rowContextByNumber.get(rowNumber) ?? `Row ${rowNumber}`,
        details: getRowDetails(rowIssues),
        inPreview: previewRowNumbers.has(rowNumber),
      };
    }),
  };
}

function getGroupTitle(
  issue: EmployeeImportValidationIssueDto,
  issueCodeCount: number
) {
  if (issue.category === "missingRequiredData") {
    return issueCodeCount > 1
      ? "Missing required fields"
      : "Missing required field";
  }

  switch (issue.code) {
    case "invalidEmail":
      return "Invalid email";
    case "invalidHireDate":
      return "Invalid hire date";
    case "invalidManagerEmail":
      return "Invalid manager email";
    case "duplicateEmailInFile":
      return "Duplicate email in uploaded file";
    case "duplicateEmailInTenant":
      return "Email already exists in tenant";
    case "orgUnitNotFound":
      return "Org unit could not be resolved";
    case "orgUnitInactive":
      return "Org unit is inactive";
    case "ambiguousManagerEmail":
      return "Manager email is duplicated in uploaded file";
    case "managerNotFound":
      return "Manager email could not be resolved";
    case "managerInactive":
      return "Manager is inactive";
    case "managerInvalidInBatch":
      return "Manager row must be fixed first";
    case "selfManager":
      return "Manager relationship is invalid";
    case "managerCycle":
      return "Circular manager chain detected";
    default:
      return issue.message;
  }
}

function getGroupShortLabel(issue: EmployeeImportValidationIssueDto) {
  if (issue.category === "missingRequiredData") {
    return "Missing fields";
  }

  switch (issue.code) {
    case "invalidEmail":
      return "Invalid email";
    case "invalidHireDate":
      return "Invalid date";
    case "invalidManagerEmail":
      return "Invalid manager";
    case "duplicateEmailInFile":
      return "Duplicate email";
    case "duplicateEmailInTenant":
      return "Existing email";
    case "orgUnitNotFound":
      return "Unknown org unit";
    case "orgUnitInactive":
      return "Inactive org unit";
    case "ambiguousManagerEmail":
      return "Duplicate manager";
    case "managerNotFound":
      return "Unknown manager";
    case "managerInactive":
      return "Inactive manager";
    case "managerInvalidInBatch":
      return "Fix manager row";
    case "selfManager":
      return "Self manager";
    case "managerCycle":
      return "Manager cycle";
    default:
      return "Issue";
  }
}

function getGroupValueLabel(issue: EmployeeImportValidationIssueDto) {
  switch (issue.code) {
    case "duplicateEmailInFile":
    case "duplicateEmailInTenant":
      return "Email";
    case "orgUnitNotFound":
    case "orgUnitInactive":
      return "Org unit code";
    case "ambiguousManagerEmail":
    case "managerNotFound":
    case "managerInactive":
    case "managerInvalidInBatch":
      return "Manager email";
    case "invalidEmail":
    case "invalidHireDate":
    case "invalidManagerEmail":
      return "Provided value";
    case "selfManager":
      return "Employee email";
    default:
      return null;
  }
}

function getRowDetails(rowIssues: EmployeeImportValidationIssueDto[]) {
  const primaryIssue = rowIssues[0]!;

  if (primaryIssue.category === "missingRequiredData") {
    const missingFields = rowIssues.map((issue) => getFieldLabel(issue.field));
    return [`Missing: ${missingFields.join(", ")}`];
  }

  if (primaryIssue.category === "invalidFormat") {
    return rowIssues.map((issue) => {
      if (issue.code === "invalidHireDate") {
        return issue.value
          ? `Provided value: ${issue.value}. Expected YYYY-MM-DD.`
          : "Expected YYYY-MM-DD format.";
      }

      if (issue.code === "invalidManagerEmail") {
        return issue.value
          ? `Provided value: ${issue.value}. Enter a valid manager email or leave it blank.`
          : "Enter a valid manager email or leave it blank.";
      }

      return issue.value
        ? `Provided value: ${issue.value}. Enter a valid work email address.`
        : "Enter a valid work email address.";
    });
  }

  if (primaryIssue.category === "duplicateIdentity") {
    return [
      primaryIssue.code === "duplicateEmailInTenant"
        ? "This row conflicts with an employee that already exists in the tenant."
        : "This row shares the same email as another row in the uploaded file.",
    ];
  }

  if (primaryIssue.category === "invalidStructureReference") {
    return [
      primaryIssue.code === "orgUnitInactive"
        ? "This row references an inactive org unit code."
        : "This row references an org unit code that was not found.",
    ];
  }

  if (primaryIssue.category === "invalidReportingReference") {
    switch (primaryIssue.code) {
      case "ambiguousManagerEmail":
        return [
          "This row references a manager email that appears multiple times in the uploaded file.",
        ];
      case "managerInactive":
        return ["This row references a manager who is inactive in the tenant."];
      case "managerInvalidInBatch":
        return [
          "This row depends on a manager record that is invalid in this upload.",
        ];
      default:
        return [
          "This row references a manager email that could not be resolved.",
        ];
    }
  }

  if (primaryIssue.code === "selfManager") {
    return ["This employee is set as their own manager."];
  }

  if (primaryIssue.code === "managerCycle") {
    return ["This row is part of a circular manager chain in the upload."];
  }

  return rowIssues.map((issue) => issue.message);
}

function getFieldLabel(field: string | null) {
  if (!field) {
    return "Field";
  }

  return FIELD_LABELS[field] ?? field;
}
