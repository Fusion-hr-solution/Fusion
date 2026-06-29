// ── Performance module API contract ──────────────────────────────────
// Mirrors EY.HRPlatform.Performance DTOs. Consumed by the Performance MFE.

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
  objectiveTemplates: () => "/performance/objective-templates",
  objectiveTemplate: (id: string) => `/performance/objective-templates/${id}`,
  objectiveTemplateArchive: (id: string) =>
    `/performance/objective-templates/${id}/archive`,
  objectiveTemplateRestore: (id: string) =>
    `/performance/objective-templates/${id}/restore`,
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
  notifications: () => [...performanceQueryKeys.all(), "notifications"] as const,
  notificationList: (params: { unreadOnly: boolean; page: number; pageSize: number }) =>
    [...performanceQueryKeys.notifications(), "list", params] as const,
  notificationUnreadCount: () =>
    [...performanceQueryKeys.notifications(), "unread-count"] as const,
} as const;
