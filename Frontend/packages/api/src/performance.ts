// ── Performance module API contract ──────────────────────────────────
// Mirrors EY.HRPlatform.Performance DTOs. Consumed by the Performance MFE.

export interface PagedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export type PerformanceCycleStatus = "Draft" | "Published" | "Active" | "Closed";
export type PerformanceCycleType = "Annual" | "MidYear" | "Specific";
export type CycleDeadlineState =
  | "None"
  | "Upcoming"
  | "DueSoon"
  | "Overdue";
export type PopulationRuleType = "OrgUnit" | "IncludeEmployee" | "ExcludeEmployee";

export interface PerformanceCycleSummaryDto {
  id: string;
  name: string;
  type: PerformanceCycleType;
  status: PerformanceCycleStatus;
  periodStart: string;
  periodEnd: string;
  objectiveSettingDeadline: string | null;
  deadlineState: CycleDeadlineState;
  participantCount: number;
  publishedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  version: number;
}

export interface PopulationRuleDto {
  ruleType: PopulationRuleType;
  refId: string;
  includeDescendants: boolean;
}

export interface PerformanceCycleDetailDto {
  id: string;
  name: string;
  description: string | null;
  type: PerformanceCycleType;
  status: PerformanceCycleStatus;
  periodStart: string;
  periodEnd: string;
  objectiveSettingDeadline: string | null;
  deadlineState: CycleDeadlineState;
  populationIncludeInactive: boolean;
  participantCount: number;
  publishedAt: string | null;
  activatedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  populationRules: PopulationRuleDto[];
}

export interface CycleParticipantDto {
  id: string;
  employeeId: string;
  employeeKey: string | null;
  fullName: string;
  email: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  jobTitle: string | null;
  managerId: string | null;
  managerName: string | null;
  planningApproverEmployeeId: string | null;
  planningApproverName: string | null;
  planningApproverSource: "Unresolved" | "DirectManager" | "EscalatedManager" | "ManualAssignment";
  planningApproverOverrideReason: string | null;
  snapshotAt: string;
}

export interface CyclePopulationMemberDto {
  employeeId: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  managerName: string | null;
  isActive: boolean;
}

export interface CyclePopulationPreviewDto {
  totalCount: number;
  members: CyclePopulationMemberDto[];
}

export interface CycleReadinessDto {
  participantCount: number;
  resolvedPlanningApproverCount: number;
  unresolvedPlanningApproverCount: number;
  unresolvedParticipants: CycleParticipantDto[];
}

export interface CycleAuditEventDto {
  id: string;
  action: string;
  actorUserId: string | null;
  actorName: string | null;
  occurredAt: string;
  details: string | null;
}

export interface ObjectiveTemplateDto {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  level: "Organization" | "Team" | "Individual";
  parentTemplateId: string | null;
  successMeasure: string | null;
  target: string | null;
  isReadyForPlanning: boolean;
  defaultWeight: number | null;
  status: "Active" | "Archived";
  createdAt: string;
  updatedAt: string | null;
  version: number;
}

export interface PerformanceNotificationDto {
  id: string;
  type: string;
  title: string;
  message: string;
  cycleId: string | null;
  createdAt: string;
  readAt: string | null;
  isRead: boolean;
}

export interface PerformancePageDto<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ── Request payloads ─────────────────────────────────────────────────

export interface CreatePerformanceCycleRequest {
  name: string;
  description?: string | null;
  type: PerformanceCycleType;
  periodStart: string;
  periodEnd: string;
  objectiveSettingDeadline?: string | null;
  populationIncludeInactive?: boolean;
}

export type UpdatePerformanceCycleRequest = CreatePerformanceCycleRequest;

export interface PopulationRuleInput {
  ruleType: PopulationRuleType;
  refId: string;
  includeDescendants?: boolean;
}

export interface SetCyclePopulationRequest {
  populationIncludeInactive: boolean;
  rules: PopulationRuleInput[];
}

export interface AssignPlanningApproverRequest {
  approverEmployeeId: string;
  reason: string;
}

export interface CreateObjectiveTemplateRequest {
  name: string;
  description?: string | null;
  category?: string | null;
  defaultWeight?: number | null;
  successMeasure?: string | null;
  target?: string | null;
  level?: "Organization" | "Team" | "Individual";
  parentTemplateId?: string | null;
}

export type UpdateObjectiveTemplateRequest = CreateObjectiveTemplateRequest;

// ── Platform defaults (P1: policy-and-templates) ─────────────────────

export interface GuardrailsDto {
  id: string;
  version: number;
  isDraft: boolean;
  minObjectivesPerPlan: number;
  maxObjectivesPerPlan: number;
  minManagerValidationSlaDays: number;
  maxManagerValidationSlaDays: number;
  permittedWeightDecimalPlaces: number;
  maxAllowedWeightingValues: number;
  supportedMeasurementTypes: string;
  maxTemplateTitleLength: number;
  maxTemplateDescriptionLength: number;
  maxTemplateTags: number;
  objectiveLibraryEnabled: boolean;
}

export type BaselineVersionStatus = "Draft" | "Published" | "Superseded";

export interface BaselineVersionDto {
  id: string;
  versionNumber: number;
  status: BaselineVersionStatus;
  maxObjectivesPerPlan: number;
  allowedWeightValues: string;
  managerValidationSlaDays: number;
  cascadeMode: string;
  measurementTypes: string;
  attachmentsEnabled: boolean;
  publishedAt: string | null;
  supersededAt: string | null;
}

export interface CreateGuardrailsDraftRequest {
  minObjectivesPerPlan: number;
  maxObjectivesPerPlan: number;
  minManagerValidationSlaDays: number;
  maxManagerValidationSlaDays: number;
  permittedWeightDecimalPlaces: number;
  maxAllowedWeightingValues: number;
  supportedMeasurementTypes: string;
  maxTemplateTitleLength: number;
  maxTemplateDescriptionLength: number;
  maxTemplateTags: number;
  objectiveLibraryEnabled: boolean;
}

export interface CreateBaselineDraftRequest {
  maxObjectivesPerPlan: number;
  allowedWeightValues: string;
  managerValidationSlaDays: number;
  cascadeMode: string;
  measurementTypes: string;
  attachmentsEnabled: boolean;
}

// ── Template categories (P1) ─────────────────────────────────────────

export type CategoryStatus = "Active" | "Archived";

export interface CategoryDto {
  id: string;
  code: string;
  name: string;
  status: CategoryStatus;
}

export interface CreateCategoryRequest {
  code: string;
  name: string;
}

export interface RenameCategoryRequest {
  name: string;
}

// ── Tenant objective policy (P1) ────────────────────────────────────

export type PolicyVersionStatus = "Draft" | "Active" | "Superseded";

export interface PolicyVersionDto {
  id: string;
  policyId: string;
  versionNumber: number;
  status: PolicyVersionStatus;
  maxObjectivesPerPlan: number;
  allowedWeightValues: string;
  managerValidationSlaDays: number;
  cascadeMode: string;
  measurementTypes: string;
  attachmentsEnabled: boolean;
  version: number;
  sourceVersionId: string | null;
  sourceBaselineVersionId: string | null;
  createdByUserId: string;
  createdByName: string | null;
  activatedAt: string | null;
  activatedByUserId: string | null;
  activatedByName: string | null;
  changeSummary: string | null;
  supersededAt: string | null;
}

export interface PolicySummaryDto {
  policyId: string;
  activeVersion: PolicyVersionDto | null;
  draftVersion: PolicyVersionDto | null;
}

export interface CreatePolicyDraftRequest {
  maxObjectivesPerPlan: number;
  allowedWeightValues: string;
  managerValidationSlaDays: number;
  cascadeMode: string;
  measurementTypes: string;
  attachmentsEnabled: boolean;
}

export interface UpdatePolicyDraftRequest extends CreatePolicyDraftRequest {
  expectedVersion: number;
}

export interface PublishPolicyRequest {
  expectedVersion: number;
  changeSummary?: string | null;
}

// ── Template library (stable-identity, P1) ───────────────────────────

export type TemplateRevisionStatus = "Draft" | "Active" | "Superseded";
export type TemplateContainerStatus = "Draft" | "Active" | "Archived";

export interface TemplateRevisionDto {
  id: string;
  templateId: string;
  versionNumber: number;
  status: TemplateRevisionStatus;
  title: string;
  description: string | null;
  categoryId: string | null;
  measurementType: "Quantitative" | "Qualitative";
  suggestedWeighting: number | null;
  tags: string | null;
  targetValue: number | null;
  unit: string | null;
  successCriteria: string | null;
  version: number;
  sourceRevisionId: string | null;
  createdByUserId: string;
  createdByName: string | null;
  activatedAt: string | null;
  activatedByUserId: string | null;
  activatedByName: string | null;
  changeSummary: string | null;
  supersededAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  applicableOrgUnitIds: string[];
  applicableJobTitles: string[];
  applicableWorkLocations: string[];
  applicableEmploymentTypes: string[];
  applicabilityValidationState: "NotValidated" | "Valid" | "HasUnresolved";
}

export interface TemplateSummaryDto {
  id: string;
  tenantId: string;
  status: TemplateContainerStatus;
  activeRevision: TemplateRevisionDto | null;
  draftRevision: TemplateRevisionDto | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface CreateTemplateDraftRequest {
  title: string;
  description?: string | null;
  categoryId?: string | null;
  measurementType: "Quantitative" | "Qualitative";
  suggestedWeighting?: number | null;
  tags?: string | null;
  targetValue?: number | null;
  unit?: string | null;
  successCriteria?: string | null;
  sourceRevisionId?: string | null;
  applicableOrgUnitIds?: string[] | null;
  applicableJobTitles?: string[] | null;
  applicableWorkLocations?: string[] | null;
  applicableEmploymentTypes?: string[] | null;
}

export interface UpdateTemplateDraftRequest extends CreateTemplateDraftRequest {
  expectedVersion: number;
}

export interface ActivateTemplateRevisionRequest {
  changeSummary?: string | null;
  expectedVersion: number;
}

export interface ApplicabilityOrgUnitDto {
  id: string;
  name: string;
  code: string;
  parentId: string | null;
}

export interface ApplicabilityOptionsDto {
  orgUnits: ApplicabilityOrgUnitDto[];
  jobTitles: string[];
  workLocations: string[];
  employmentTypes: string[];
}

// ── Paths ────────────────────────────────────────────────────────────

export const performancePaths = {
  cycles: () => "/performance/cycles",
  cycle: (id: string) => `/performance/cycles/${id}`,
  cyclePopulation: (id: string) => `/performance/cycles/${id}/population`,
  cyclePopulationPreview: (id: string) =>
    `/performance/cycles/${id}/population/preview`,
  cyclePublish: (id: string) => `/performance/cycles/${id}/publish`,
  cycleActivate: (id: string) => `/performance/cycles/${id}/activate`,
  cycleClose: (id: string) => `/performance/cycles/${id}/close`,
  cycleParticipants: (id: string) => `/performance/cycles/${id}/participants`,
  cycleAudit: (id: string) => `/performance/cycles/${id}/audit`,
  cycleReadiness: (id: string) => `/performance/cycles/${id}/readiness`,
  cyclePlanningApprover: (cycleId: string, participantId: string) =>
    `/performance/cycles/${cycleId}/participants/${participantId}/planning-approver`,
  // Platform defaults
  platformGuardrails: () => "/performance/platform/defaults/guardrails",
  platformGuardrailsDraft: () => "/performance/platform/defaults/guardrails/draft",
  platformGuardrailsPublish: () => "/performance/platform/defaults/guardrails/publish",
  platformBaseline: () => "/performance/platform/defaults/baseline",
  platformBaselineDraft: () => "/performance/platform/defaults/baseline/draft",
  platformBaselinePublish: () => "/performance/platform/defaults/baseline/publish",

  // Template categories
  templateCategories: () => "/performance/template-categories",
  templateCategory: (id: string) => `/performance/template-categories/${id}`,
  templateCategoryArchive: (id: string) => `/performance/template-categories/${id}/archive`,
  templateCategoryReactivate: (id: string) => `/performance/template-categories/${id}/reactivate`,

  // Tenant objective policy
  policy: () => "/performance/policy",
  policyHistory: () => "/performance/policy/history",
  policyDraft: () => "/performance/policy/draft",
  policyDraftPublish: () => "/performance/policy/draft/publish",

  objectiveTemplates: () => "/performance/objective-templates",
  objectiveTemplate: (id: string) => `/performance/objective-templates/${id}`,
  objectiveTemplateArchive: (id: string) =>
    `/performance/objective-templates/${id}/archive`,
  objectiveTemplateRestore: (id: string) =>
    `/performance/objective-templates/${id}/restore`,
  // Template library (stable-identity, P1)
  templateLibrary: () => "/performance/template-library",
  templateLibraryItem: (id: string) => `/performance/template-library/${id}`,
  templateLibraryDraft: (id: string) => `/performance/template-library/${id}/draft`,
  templateLibraryDraftActivate: (id: string) => `/performance/template-library/${id}/draft/activate`,
  templateLibraryRevise: (id: string) => `/performance/template-library/${id}/revise`,
  templateLibraryArchive: (id: string) => `/performance/template-library/${id}/archive`,
  templateLibraryRestore: (id: string) => `/performance/template-library/${id}/restore`,
  templateLibraryDuplicate: (id: string) => `/performance/template-library/${id}/duplicate`,
  templateLibraryApplicabilityOptions: () => "/performance/template-library/applicability-options",
  notifications: () => "/performance/notifications",
  notificationsUnreadCount: () => "/performance/notifications/unread-count",
  notificationRead: (id: string) => `/performance/notifications/${id}/read`,
  notificationsReadAll: () => "/performance/notifications/read-all",
} as const;

// ── Query keys ───────────────────────────────────────────────────────

export const performanceQueryKeys = {
  all: () => ["performance"] as const,
  cycles: () => [...performanceQueryKeys.all(), "cycles"] as const,
  cycleList: (params: {
    search?: string | null;
    status?: string | null;
    type?: string | null;
    page: number;
    pageSize: number;
  }) =>
    [
      ...performanceQueryKeys.cycles(),
      "list",
      {
        search: params.search?.trim() || null,
        status: params.status ?? null,
        type: params.type ?? null,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
  cycle: (id: string) => [...performanceQueryKeys.cycles(), id] as const,
  cyclePopulationPreview: (id: string) =>
    [...performanceQueryKeys.cycle(id), "population-preview"] as const,
  cycleParticipants: (id: string, params: { search?: string | null; page: number; pageSize: number }) =>
    [
      ...performanceQueryKeys.cycle(id),
      "participants",
      {
        search: params.search?.trim() || null,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
  cycleAudit: (id: string) => [...performanceQueryKeys.cycle(id), "audit"] as const,
  cycleReadiness: (id: string) => [...performanceQueryKeys.cycle(id), "readiness"] as const,
  objectiveTemplates: () =>
    [...performanceQueryKeys.all(), "objective-templates"] as const,
  objectiveTemplateList: (params: {
    search?: string | null;
    status?: string | null;
    category?: string | null;
    page: number;
    pageSize: number;
  }) =>
    [
      ...performanceQueryKeys.objectiveTemplates(),
      "list",
      {
        search: params.search?.trim() || null,
        status: params.status ?? null,
        category: params.category ?? null,
        page: params.page,
        pageSize: params.pageSize,
      },
    ] as const,
  // Template categories
  templateCategories: () => [...performanceQueryKeys.all(), "template-categories"] as const,
  // Template library (stable-identity, P1)
  templateLibrary: (params?: { search?: string | null; status?: string | null; categoryId?: string | null; measurementType?: string | null; page?: number; pageSize?: number }) =>
    [...performanceQueryKeys.all(), "template-library", params ?? {}] as const,
  templateLibraryItem: (id: string) => [...performanceQueryKeys.all(), "template-library", id] as const,
  applicabilityOptions: () => [...performanceQueryKeys.all(), "applicability-options"] as const,
  // Tenant policy query keys
  policy: () => [...performanceQueryKeys.all(), "policy"] as const,
  policyHistory: () => [...performanceQueryKeys.policy(), "history"] as const,
  // Platform defaults query keys
  platformDefaults: () => [...performanceQueryKeys.all(), "platform-defaults"] as const,
  platformGuardrails: () => [...performanceQueryKeys.platformDefaults(), "guardrails"] as const,
  platformBaseline: () => [...performanceQueryKeys.platformDefaults(), "baseline"] as const,

  notifications: () => [...performanceQueryKeys.all(), "notifications"] as const,
  notificationList: (params: { unreadOnly: boolean; page: number; pageSize: number }) =>
    [...performanceQueryKeys.notifications(), "list", params] as const,
  notificationUnreadCount: () =>
    [...performanceQueryKeys.notifications(), "unread-count"] as const,
} as const;
