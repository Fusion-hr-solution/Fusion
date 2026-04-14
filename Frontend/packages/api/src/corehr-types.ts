/** DTOs aligned with CoreHR service APIs (camelCase JSON). */

export type SetupStatus = "NotStarted" | "InProgress" | "Operational";

export type EmployeeStatus = "Active" | "Inactive" | "OnLeave" | "Terminated";

// ── Org Units ─────────────────────────────────────────────────────────

export interface OrgUnitListItemDto {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  externalId: string | null;
  description: string | null;
  costCenterCode: string | null;
}

export interface OrgUnitDto {
  id: string;
  code: string;
  name: string;
  type: string;
  parentId: string | null;
  parentName: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  externalId: string | null;
  description: string | null;
  costCenterCode: string | null;
}

export interface OrgUnitTreeNodeDto {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  isOrphaned: boolean;
  children: OrgUnitTreeNodeDto[];
}

export interface CreateOrgUnitRequest {
  code: string;
  name: string;
  type: string;
  parentId?: string | null;
}

export interface UpdateOrgUnitRequest {
  name: string;
  type: string;
  parentId?: string | null;
}

export interface UpdateTenantSettingsRequest {
  orgUnitTypes?: string[];
  employeeFieldConfig?: Record<string, FieldConfigInput>;
  branding?: BrandingSettingsInput;
  orgUnitImportColumnConfig?: Record<string, OrgUnitImportColumnConfigInput>;
}

export interface FieldConfigInput {
  visible?: boolean | null;
  required?: boolean | null;
  visibleToEmployee?: boolean | null;
  visibleToManager?: boolean | null;
}

export interface BrandingSettingsInput {
  logoUrl?: string | null;
  primaryColor?: string | null;
}

export interface OrgUnitImportColumnConfig {
  enabled: boolean;
  required: boolean;
}

export interface OrgUnitImportColumnConfigInput {
  enabled?: boolean | null;
  required?: boolean | null;
}

// ── Org Unit Import ───────────────────────────────────────────────────

export type ImportRowStatus = "Valid" | "Error";

export type OrgUnitImportPreviewStage = "Mapping" | "Review";

export interface OrgUnitImportColumnMapping {
  code: string | null;
  name: string | null;
  type: string | null;
  parentCode: string | null;
  externalId: string | null;
  description: string | null;
  costCenterCode: string | null;
}

export interface OrgUnitImportSourceColumn {
  header: string;
  sampleValues: string[];
}

export interface OrgUnitImportDraftNode {
  id: string;
  code: string;
  name: string;
  type: string;
  level: number;
  isExistingParentAnchor: boolean;
  children: OrgUnitImportDraftNode[];
}

export interface OrgUnitImportRowResult {
  rowNumber: number;
  code: string;
  name: string;
  type: string;
  parentCode: string | null;
  status: ImportRowStatus;
  errors: string[];
  resolvedParentId: string | null;
}

export interface OrgUnitImportPreviewResult {
  stage: OrgUnitImportPreviewStage;
  isValid: boolean;
  totalRows: number;
  validRows: number;
  errorRows: number;
  requiresCategoryApproval: boolean;
  unknownTypes: string[];
  availableColumns: OrgUnitImportSourceColumn[];
  suggestedMapping: OrgUnitImportColumnMapping;
  mapping: OrgUnitImportColumnMapping | null;
  rows: OrgUnitImportRowResult[];
  draftHierarchy: OrgUnitImportDraftNode[];
}

export interface OrgUnitImportedRow {
  code: string;
  name: string;
  id: string;
}

export interface OrgUnitImportResult {
  importedCount: number;
  rows: OrgUnitImportedRow[];
}

// ── Paged response (matches backend PagedResponse<T>) ────────────────

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ── Employees ─────────────────────────────────────────────────────────

export interface ManagerDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fullName: string;
}

export interface OrgUnitRefDto {
  id: string;
  name: string;
  type: string;
}

export interface EmployeeListItemDto {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  status: EmployeeStatus;
  hireDate: string;
  managerId: string | null;
  managerName: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
}

export interface EmployeeDto {
  id: string;
  tenantId: string;
  firstName: string;
  lastName: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
  hireDate: string;
  status: EmployeeStatus;
  managerId: string | null;
  manager: ManagerDto | null;
  orgUnitId: string | null;
  orgUnit: OrgUnitRefDto | null;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  fullName: string;
}

// ── Setup State ───────────────────────────────────────────────────────

export interface SetupStateDto {
  id: string;
  tenantId: string;
  status: SetupStatus;
  orgUnitsConfigured: boolean;
  employeesImported: boolean;
  createdAt: string;
  updatedAt: string | null;
  version: number;
}

// ── Tenant Settings ───────────────────────────────────────────────────

export interface FieldConfig {
  visible: boolean;
  required: boolean;
  visibleToEmployee: boolean;
  visibleToManager: boolean;
}

export interface BrandingSettings {
  logoUrl: string | null;
  primaryColor: string | null;
}

export interface TenantSettingsDto {
  version: number | null;
  orgUnitTypes: string[];
  employeeFieldConfig: Record<string, FieldConfig>;
  orgUnitImportColumnConfig: Record<string, OrgUnitImportColumnConfig>;
  branding: BrandingSettings;
}