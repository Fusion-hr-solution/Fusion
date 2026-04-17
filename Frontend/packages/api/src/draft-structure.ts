export type DraftStructureWorkspaceStatus = "empty" | "inProgress";

export type DraftStructureAttributeValueType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "singleSelect";

export type DraftStructureImportStage =
  | "Uploaded"
  | "Mapped"
  | "KindReconciled"
  | "Validated"
  | "Applied"
  | "Expired";

export interface OrgUnitKindDto {
  key: string;
  displayLabel: string;
}

export interface DraftStructureAttributeDefinitionDto {
  key: string;
  displayLabel: string;
  valueType: DraftStructureAttributeValueType;
  required: boolean;
  allowedValues: string[] | null;
  appliesToKindKeys: string[] | null;
}

export interface DraftStructureSchemaDto {
  orgUnitKinds: OrgUnitKindDto[];
  attributes: DraftStructureAttributeDefinitionDto[];
}

export interface DraftOrgUnitDto {
  id: string;
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  orgUnitKindLabel: string;
  location: string | null;
  description: string | null;
  parentId: string | null;
  parentReferenceKey: string | null;
  parentDisplayName: string | null;
  attributes: Record<string, unknown>;
  createdAt: string;
  updatedAt: string | null;
  version: number;
}

export interface DraftOrgUnitTreeNodeDto {
  id: string;
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  orgUnitKindLabel: string;
  location: string | null;
  level: number;
  isOrphaned: boolean;
  children: DraftOrgUnitTreeNodeDto[];
}

export interface DraftStructureWorkspaceDto {
  workspaceStatus: DraftStructureWorkspaceStatus;
  unitCount: number;
  rootUnitCount: number;
  lastModifiedAt: string | null;
  draftStructureSchema: DraftStructureSchemaDto;
  units: DraftOrgUnitDto[];
}

export interface CreateDraftOrgUnitRequest {
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  location: string | null;
  description: string | null;
  parentId: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface UpdateDraftOrgUnitRequest {
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  location: string | null;
  description: string | null;
  parentId: string | null;
  attributes?: Record<string, unknown> | null;
}

export interface DraftStructureImportCanonicalFieldDto {
  key: string;
  displayLabel: string;
  required: boolean;
  valueType: string;
  allowedValues: string[] | null;
  appliesToKindKeys: string[] | null;
}

export interface DraftStructureImportSchemaDto {
  draftStructureSchema: DraftStructureSchemaDto;
  canonicalFields: DraftStructureImportCanonicalFieldDto[];
}

export interface DraftStructureImportSourceRowDto {
  rowNumber: number;
  values: Record<string, string | null>;
}

export interface DraftStructureImportKindResolutionDto {
  sourceValue: string;
  resolvedOrgUnitKindKey: string | null;
  resolvedDisplayLabel: string | null;
  createNewKind: boolean;
  isResolved: boolean;
  suggestedOrgUnitKindKey: string;
}

export interface DraftStructureImportValidationIssueDto {
  rowNumber: number;
  field: string | null;
  severity: string;
  code: string;
  message: string;
}

export interface DraftStructureImportValidationSummaryDto {
  totalRows: number;
  validRows: number;
  errorCount: number;
  warningCount: number;
}

export interface DraftStructureImportPreviewRowDto {
  rowNumber: number;
  referenceKey: string;
  displayName: string;
  orgUnitKindKey: string;
  orgUnitKindLabel: string;
  parentReferenceKey: string | null;
  location: string | null;
  description: string | null;
  attributes: Record<string, unknown>;
}

export interface DraftStructureImportSessionDto {
  id: string;
  stage: DraftStructureImportStage;
  version: number;
  sourceFileName: string;
  sourceFileSizeBytes: number;
  sourceRowCount: number;
  sourceHeaders: string[];
  sampleRows: DraftStructureImportSourceRowDto[];
  importSchema: DraftStructureImportSchemaDto;
  columnMappings: Record<string, string>;
  kindResolutions: DraftStructureImportKindResolutionDto[];
  validationSummary: DraftStructureImportValidationSummaryDto;
  validationIssues: DraftStructureImportValidationIssueDto[];
  previewRows: DraftStructureImportPreviewRowDto[];
  expiresAt: string;
  canValidate: boolean;
  canApply: boolean;
}

export interface DraftStructureImportMappingRequest {
  columnMappings: Record<string, string>;
}

export interface DraftStructureImportResolveKindInputDto {
  sourceValue: string;
  orgUnitKindKey: string | null;
  displayLabel: string | null;
  createNewKind: boolean;
}

export interface DraftStructureImportResolveKindsRequest {
  kindResolutions: DraftStructureImportResolveKindInputDto[];
}

export interface DraftStructureImportApplyResultDto {
  sessionId: string;
  replacedUnitCount: number;
  draftStructureSchema: DraftStructureSchemaDto;
  appliedAt: string;
}

export const draftStructurePaths = {
  workspace: () => "/corehr/setup/draft-structure",
  tree: () => "/corehr/setup/draft-structure/tree",
  detail: (id: string) => `/corehr/setup/draft-structure/${id}`,
  create: () => "/corehr/setup/draft-structure",
  update: (id: string) => `/corehr/setup/draft-structure/${id}`,
  remove: (id: string) => `/corehr/setup/draft-structure/${id}`,
  importSchema: () => "/corehr/setup/draft-structure/import/schema",
  importTemplate: () => "/corehr/setup/draft-structure/import/template",
  importUpload: () => "/corehr/setup/draft-structure/import",
  importSession: (id: string) => `/corehr/setup/draft-structure/import/${id}`,
  importMapping: (id: string) => `/corehr/setup/draft-structure/import/${id}/mapping`,
  importKinds: (id: string) => `/corehr/setup/draft-structure/import/${id}/kinds`,
  importValidate: (id: string) => `/corehr/setup/draft-structure/import/${id}/validate`,
  importApply: (id: string) => `/corehr/setup/draft-structure/import/${id}/apply`,
} as const;