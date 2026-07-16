import type { EmployeeReadinessFixTargetDto } from "../employee-roster.types";

export type EmployeeImportStage =
  | "PreviewReady"
  | "Validated"
  | "Applying"
  | "Applied"
  | "Expired";

export type EmployeeImportPreviewFilter = "all" | "affected";

export type EmployeeImportIssueCategory =
  | "missingRequiredData"
  | "invalidFormat"
  | "duplicateIdentity"
  | "invalidStructureReference"
  | "invalidReportingReference"
  | "invalidRelationship";

export interface EmployeeImportCanonicalFieldDto {
  key: string;
  displayLabel: string;
  required: boolean;
  description: string;
  example: string;
}

export interface EmployeeImportSchemaDto {
  canonicalFields: EmployeeImportCanonicalFieldDto[];
}

export interface EmployeeImportSourceRowDto {
  rowNumber: number;
  values: Record<string, string | null>;
}

export interface EmployeeImportValidationIssueDto {
  rowNumber: number;
  field: string | null;
  severity: string;
  code: string;
  message: string;
  category: EmployeeImportIssueCategory;
  groupKey: string;
  value: string | null;
  fixHint: string;
}

export interface EmployeeImportValidationSummaryDto {
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
}

export type EmployeeImportRowClassification =
  | "Create"
  | "Unchanged"
  | "ProfileCorrection"
  | "EmploymentChange"
  | "WorkAssignmentChange"
  | "ManagerChange"
  | "Invalid"
  | "Conflicting";

export interface EmployeeImportPreviewRowDto {
  rowNumber: number;
  employeeNumber: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  hireDate: string | null;
  jobTitle: string | null;
  workLocation: string | null;
  employmentType: string | null;
  orgUnitCode: string | null;
  managerEmail: string | null;
  effectiveDate: string | null;
  classification: EmployeeImportRowClassification | null;
  resolvedEffectiveDate: string | null;
  matchedEmployeeId: string | null;
  changedFacts: string[] | null;
}

export type EmployeeImportMode = "BusinessChange" | "Correction";

export type EmployeeImportApplyOperationStatus =
  | "Queued"
  | "Running"
  | "Succeeded"
  | "Failed";

export interface EmployeeImportApplyOperationDto {
  id: string;
  sessionId: string;
  status: EmployeeImportApplyOperationStatus;
  actorUserId: string;
  actorFullName: string;
  actorRole: string;
  queuedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  historyId: string | null;
  sourceRowCount: number | null;
  validatedRowCount: number | null;
  processedRowCount: number;
  createdCount: number | null;
  publishedRowCount: number | null;
}

export interface EmployeeImportApplyResultDto {
  sessionId: string;
  historyId: string;
  sourceFileName: string;
  sourceRowCount: number;
  validatedRowCount: number;
  createdCount: number;
  publishedRowCount: number;
  appliedAt: string;
  stage: EmployeeImportStage;
}

export type ImportHistoryEventType = "Upload" | "Validation" | "Import";

export interface EmployeeImportHistoryListItemDto {
  id: string;
  sessionId: string;
  sourceFileName: string;
  sourceFileSizeBytes: number;
  sourceRowCount: number;
  validatedRowCount: number;
  createdCount: number;
  unchangedRowCount: number;
  publishedRowCount: number;
  status: string;
  appliedAt: string;
  actorUserId: string;
  actorFullName: string;
  actorRole: string;
  eventType: ImportHistoryEventType;
  errorCount?: number;
  warningCount?: number;
}

export interface EmployeeImportHistoryDetailDto {
  id: string;
  sessionId: string;
  version: number;
  sourceFileName: string;
  sourceFileSizeBytes: number;
  sourceRowCount: number;
  validatedRowCount: number;
  createdCount: number;
  unchangedRowCount: number;
  publishedRowCount: number;
  status: string;
  appliedAt: string;
  actorUserId: string;
  actorFullName: string;
  actorRole: string;
  failureReason: string | null;
  unresolvedFollowUpIssues: EmployeeImportFollowUpIssueDto[];
  eventType: ImportHistoryEventType;
  errorCount?: number;
  warningCount?: number;
}

export interface EmployeeImportFollowUpIssueDto {
  id: string;
  sourceRowNumber: number;
  employeeId: string;
  employeeFullName: string;
  employeeEmail: string;
  code:
    | "MissingRequiredField"
    | "MissingOrgUnit"
    | "NoManagerAssigned"
    | "ManagerInactive"
    | "ManagerMissing"
    | "DeactivationBlocked";
  label: string;
  fieldKey: string | null;
  fixTarget: EmployeeReadinessFixTargetDto;
}

export interface EmployeeImportHistoryPageDto {
  items: EmployeeImportHistoryListItemDto[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
  pageCount: number;
}

export interface EmployeeImportSessionDto {
  id: string;
  stage: EmployeeImportStage;
  version: number;
  batchEffectiveDate: string | null;
  importMode: EmployeeImportMode | null;
  sourceFileName: string;
  sourceFileSizeBytes: number;
  sourceRowCount: number;
  sourceHeaders: string[];
  sampleRows: EmployeeImportSourceRowDto[];
  previewRows: EmployeeImportPreviewRowDto[];
  previewPageNumber: number;
  previewPageSize: number;
  previewPageCount: number;
  totalPreviewRowCount: number;
  hasMorePreviewRows: boolean;
  validationSummary: EmployeeImportValidationSummaryDto;
  validationIssues: EmployeeImportValidationIssueDto[];
  lastApplyOperation: EmployeeImportApplyOperationDto | null;
  appliedAt: string | null;
  expiresAt: string;
  employeeImportSchema: EmployeeImportSchemaDto;
  canValidate: boolean;
  canApply: boolean;
}
