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

export type PerformanceCycleStatus =
  | "Draft"
  | "AssignmentPreparation"
  | "ReadyToLaunch"
  | "Active"
  | "Closed"
  | "ForceClosed";
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
  slug: string;
  referenceYear: number | null;
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
  slug: string;
  description: string | null;
  purpose: string | null;
  referenceYear: number | null;
  ownerUserId: string | null;
  ownerName: string | null;
  type: PerformanceCycleType;
  status: PerformanceCycleStatus;
  periodStart: string;
  periodEnd: string;
  objectiveSettingDeadline: string | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  expectedPlanningLockDate: string | null;
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
  governance?: unknown;
  planningRulesSnapshot: CampaignPlanningRulesSnapshotDto | null;
  strategicObjectives: CampaignStrategicObjectiveDto[];
  draftCompleteness: CampaignDraftCompletenessDto;
}

export interface CampaignPlanningRulesSnapshotDto {
  maxObjectiveCount: number;
  allowedWeightMenu: string;
  enabledMeasurementMethods: string;
  sourceConfigurationVersionId: string;
  capturedAt: string;
}

export interface CampaignStrategicObjectiveDto {
  id: string;
  title: string;
  description: string | null;
  responsibleFunctionLabel: string | null;
  isActive: boolean;
  version: number;
}

export interface CampaignDraftCompletenessDto {
  isComplete: boolean;
  blockingReasons: string[];
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
  type?: PerformanceCycleType;
  periodStart?: string;
  periodEnd?: string;
  objectiveSettingDeadline?: string | null;
  referenceYear?: number;
  purpose?: string | null;
  planningOpeningDate?: string;
  employeeSubmissionDeadline?: string;
  managerApprovalDeadline?: string;
  expectedPlanningLockDate?: string;
  populationIncludeInactive?: boolean;
}

export type UpdatePerformanceCycleRequest = CreatePerformanceCycleRequest;

export interface UpsertCampaignStrategicObjectiveRequest {
  title: string;
  description?: string | null;
  responsibleFunctionLabel?: string | null;
}

export interface ToggleCampaignStrategicObjectiveRequest {
  isActive: boolean;
}

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

// ── Platform performance configuration ──────────────────────────────

export interface StartingObjectivePlanningConfigurationDto {
  id: string;
  versionNumber: number;
  maxObjectiveCount: number;
  allowedWeights: string;
  quantitativeEnabled: boolean;
  qualitativeEnabled: boolean;
  appliedAt: string | null;
}

export interface PlatformPerformanceConfigurationDto {
  id: string;
  version: number;
  maxObjectiveCountLimit: number;
  supportedAllowedWeights: string;
  quantitativeAvailable: boolean;
  qualitativeAvailable: boolean;
  startingConfiguration: StartingObjectivePlanningConfigurationDto;
  appliedAt: string | null;
  appliedByUserId: string | null;
  appliedByName: string | null;
}

export interface PlatformPerformanceConfigurationSummaryDto {
  isConfigured: boolean;
  configuration: PlatformPerformanceConfigurationDto | null;
}

export interface ApplyPlatformPerformanceConfigurationRequest {
  maxObjectiveCountLimit: number;
  supportedAllowedWeights: string;
  quantitativeAvailable: boolean;
  qualitativeAvailable: boolean;
  startingMaxObjectiveCount: number;
  startingAllowedWeights: string;
  startingQuantitativeEnabled: boolean;
  startingQualitativeEnabled: boolean;
}

export interface PlatformConfigurationImpactDto {
  affectedTenantConfigurationCount: number;
  blockingReasons: string[];
}

export interface PlatformConfigurationApplyResultDto {
  applied: boolean;
  configuration: PlatformPerformanceConfigurationDto | null;
  errors: string[];
  impact: PlatformConfigurationImpactDto | null;
}

// ── Tenant objective planning configuration ─────────────────────────

export interface ObjectivePlanningConfigurationDto {
  id: string;
  configurationId: string;
  isConfigured: boolean;
  maxObjectiveCount: number;
  allowedWeights: string;
  quantitativeEnabled: boolean;
  qualitativeEnabled: boolean;
  version: number;
  sourceVersionId: string | null;
  sourceStartingConfigurationId: string | null;
  createdByUserId: string;
  createdByName: string | null;
  appliedAt: string | null;
  changeSummary: string | null;
}

export interface ObjectivePlanningConfigurationSummaryDto {
  isConfigured: boolean;
  configuration: ObjectivePlanningConfigurationDto | null;
  options: ObjectivePlanningConfigurationOptionsDto | null;
}

export interface ObjectivePlanningConfigurationOptionsDto {
  maxObjectiveCountLimit: number;
  supportedAllowedWeights: string;
  quantitativeAvailable: boolean;
  qualitativeAvailable: boolean;
}

export interface ApplyObjectivePlanningConfigurationRequest {
  maxObjectiveCount: number;
  allowedWeights: string;
  quantitativeEnabled: boolean;
  qualitativeEnabled: boolean;
  changeSummary?: string | null;
}

// Outcome of a tenant apply. Mirrors PlatformConfigurationApplyResultDto so both
// configuration surfaces report a blocked attempt identically (applied=false + errors).
export interface ObjectivePlanningConfigurationApplyResultDto {
  applied: boolean;
  configuration: ObjectivePlanningConfigurationDto | null;
  errors: string[];
}

// ── Paths ────────────────────────────────────────────────────────────

export const performancePaths = {
  cycles: () => "/performance/cycles",
  cycle: (id: string) => `/performance/cycles/${id}`,
  cycleBySlug: (slug: string) => `/performance/cycles/by-slug/${slug}`,
  cyclePopulation: (id: string) => `/performance/cycles/${id}/population`,
  cyclePopulationPreview: (id: string) =>
    `/performance/cycles/${id}/population/preview`,
  cyclePublish: (id: string) => `/performance/cycles/${id}/publish`,
  cycleActivate: (id: string) => `/performance/cycles/${id}/activate`,
  cycleClose: (id: string) => `/performance/cycles/${id}/close`,
  cycleParticipants: (id: string) => `/performance/cycles/${id}/participants`,
  cycleAudit: (id: string) => `/performance/cycles/${id}/audit`,
  cycleReadiness: (id: string) => `/performance/cycles/${id}/readiness`,
  campaignStrategicObjectives: (id: string) =>
    `/performance/cycles/${id}/strategic-objectives`,
  campaignStrategicObjective: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/strategic-objectives/${objectiveId}`,
  campaignStrategicObjectiveActiveState: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/strategic-objectives/${objectiveId}/active-state`,
  cyclePlanningApprover: (cycleId: string, participantId: string) =>
    `/performance/cycles/${cycleId}/participants/${participantId}/planning-approver`,
  platformPerformanceConfiguration: () =>
    "/performance/platform/configuration",
  platformPerformanceConfigurationApply: () =>
    "/performance/platform/configuration/apply",
  objectivePlanningConfiguration: () =>
    "/performance/objective-planning/configuration",
  objectivePlanningConfigurationApply: () =>
    "/performance/objective-planning/configuration/apply",
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
  cycleBySlug: (slug: string) =>
    [...performanceQueryKeys.cycles(), "by-slug", slug] as const,
  campaignStrategicObjectives: (id: string) =>
    [...performanceQueryKeys.cycle(id), "strategic-objectives"] as const,
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
  objectivePlanningConfiguration: () =>
    [...performanceQueryKeys.all(), "objective-planning-configuration"] as const,
  platformPerformanceConfiguration: () =>
    [...performanceQueryKeys.all(), "platform-performance-configuration"] as const,
  notifications: () => [...performanceQueryKeys.all(), "notifications"] as const,
  notificationList: (params: { unreadOnly: boolean; page: number; pageSize: number }) =>
    [...performanceQueryKeys.notifications(), "list", params] as const,
  notificationUnreadCount: () =>
    [...performanceQueryKeys.notifications(), "unread-count"] as const,
} as const;
