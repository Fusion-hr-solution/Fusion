export type EmployeeImportStage = "PreviewReady" | "Validated" | "Expired";

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

export interface EmployeeImportPreviewRowDto {
  rowNumber: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  hireDate: string | null;
  jobTitle: string | null;
  orgUnitCode: string | null;
  managerEmail: string | null;
}

export interface EmployeeImportSessionDto {
  id: string;
  stage: EmployeeImportStage;
  version: number;
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
  expiresAt: string;
  employeeImportSchema: EmployeeImportSchemaDto;
  canValidate: boolean;
}
