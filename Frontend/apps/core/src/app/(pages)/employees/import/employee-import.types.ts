export type EmployeeImportStage = "PreviewReady" | "Expired";

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
  hasMorePreviewRows: boolean;
  expiresAt: string;
  employeeImportSchema: EmployeeImportSchemaDto;
}
