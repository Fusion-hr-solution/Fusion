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
  | "Launched";
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
  launchedAt: string | null;
  closedAt: string | null;
  planningLockedAt: string | null;
  planningLockedByName: string | null;
  createdAt: string;
  version: number;
}

export interface PopulationRuleDto {
  ruleType: PopulationRuleType;
  refId: string;
  includeDescendants: boolean;
  reason: string | null;
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
  launchedAt: string | null;
  closedAt: string | null;
  planningLockedAt: string | null;
  planningLockedByName: string | null;
  createdAt: string;
  updatedAt: string | null;
  version: number;
  populationRules: PopulationRuleDto[];
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
  approverEmployeeId: string;
  approverName: string;
  isApproverOverridden: boolean;
  approverOverrideReason: string | null;
  snapshotAt: string;
}

export interface CyclePopulationMemberDto {
  employeeId: string;
  fullName: string;
  email: string | null;
  jobTitle: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  managerId: string | null;
  managerName: string | null;
  isActive: boolean;
}

export interface CampaignPopulationExclusionDto {
  employeeId: string;
  fullName: string | null;
  reason: string;
}

export interface CyclePopulationPreviewDto {
  isAllActiveBaseline: boolean;
  totalCount: number;
  members: CyclePopulationMemberDto[];
  exclusions: CampaignPopulationExclusionDto[];
}

export interface CampaignReadinessParticipantDto {
  employeeId: string;
  fullName: string;
  orgUnitName: string | null;
  jobTitle: string | null;
  approverEmployeeId: string | null;
  approverName: string | null;
  isApproverOverridden: boolean;
  approverOverrideReason: string | null;
  hasApprover: boolean;
}

export type CampaignReadinessSeverity = "Blocking" | "Informational";

export interface CampaignReadinessConditionDto {
  code: string;
  severity: CampaignReadinessSeverity;
  message: string;
  employeeId: string | null;
}

export interface CycleReadinessDto {
  canLaunch: boolean;
  isAllActiveBaseline: boolean;
  includedCount: number;
  participants: CampaignReadinessParticipantDto[];
  exclusions: CampaignPopulationExclusionDto[];
  blockingConditions: CampaignReadinessConditionDto[];
  informationalConditions: CampaignReadinessConditionDto[];
}

export interface CampaignLaunchResultDto {
  id: string;
  status: PerformanceCycleStatus;
  launchedAt: string | null;
  frozenParticipantCount: number;
  version: number;
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
  subjectType: string | null;
  subjectId: string | null;
  navigationRoute: string | null;
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
  reason?: string | null;
}

export interface SetCyclePopulationRequest {
  populationIncludeInactive: boolean;
  rules: PopulationRuleInput[];
}

export interface OverrideParticipantApproverRequest {
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

// ── Team objectives (P1.3) ───────────────────────────────────────────

export interface TeamObjectiveDto {
  id: string;
  cycleId: string;
  strategicObjectiveId: string;
  strategicObjectiveTitle: string;
  ownerManagerEmployeeId: string;
  ownerManagerName: string;
  title: string;
  successCriteria: string;
  measurementMethod: string;
  description: string | null;
  createdAt: string;
  updatedAt: string | null;
  version: number;
}

export interface MyTeamObjectiveCampaignDto {
  id: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  launchedAt: string | null;
  scopeParticipantCount: number;
  myTeamObjectiveCount: number;
}

export interface TeamObjectiveScopeParticipantDto {
  employeeId: string;
  fullName: string;
  jobTitle: string | null;
  orgUnitName: string | null;
}

export interface TeamObjectiveScopeDto {
  participantCount: number;
  orgUnitNames: string[];
  participants: TeamObjectiveScopeParticipantDto[];
}

export interface TeamObjectiveStrategicObjectiveDto {
  id: string;
  title: string;
  description: string | null;
  responsibleFunctionLabel: string | null;
}

export interface TeamObjectiveWorkspaceDto {
  cycleId: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  launchedAt: string | null;
  enabledMeasurementMethods: string[];
  strategicObjectives: TeamObjectiveStrategicObjectiveDto[];
  myScope: TeamObjectiveScopeDto;
  myTeamObjectives: TeamObjectiveDto[];
}

export interface UpsertTeamObjectiveRequest {
  strategicObjectiveId: string;
  title: string;
  successCriteria: string;
  measurementMethod: string;
  description: string | null;
}

// ── Employee objectives (P1.4) ──────────────────────────────────────

export type EmployeeObjectivePlanStatus = "Draft" | "Submitted" | "ChangesRequested" | "Approved";
export type ObjectiveAlignmentType = "TeamObjective" | "StrategicObjective";
export type PlanReviewEventType = "Submitted" | "ChangesRequested" | "Resubmitted" | "Approved";

export interface MyObjectivePlanCampaignDto {
  id: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  launchedAt: string | null;
  planStatus: EmployeeObjectivePlanStatus | null;
  objectiveCount: number;
  totalWeight: number;
}

export interface EmployeeObjectiveDto {
  id: string;
  title: string;
  description: string | null;
  alignmentType: ObjectiveAlignmentType | null;
  alignmentTargetId: string | null;
  alignmentTitle: string | null;
  weight: number | null;
  deadline: string | null;
  measurementMethod: string | null;
  measurementIndicator: string | null;
  targetValue: string | null;
  targetUnit: string | null;
  successCriteria: string | null;
  createdAt: string;
  updatedAt: string | null;
}

export interface EmployeeObjectivePlanDto {
  id: string;
  cycleId: string;
  employeeId: string;
  status: EmployeeObjectivePlanStatus;
  submittedAt: string | null;
  approverEmployeeId: string | null;
  approverName: string | null;
  approvedAt: string | null;
  approvingManagerEmployeeId: string | null;
  approvingManagerName: string | null;
  lastChangeRequestComment: string | null;
  objectiveCount: number;
  totalWeight: number;
  version: number;
  objectives: EmployeeObjectiveDto[];
  reviewHistory: EmployeeObjectivePlanReviewHistoryEventDto[];
}

export interface EmployeeObjectivePlanReviewHistoryEventDto {
  id: string;
  type: PlanReviewEventType;
  actorEmployeeId: string;
  actorName: string;
  comment: string | null;
  referencedObjectiveIds: string[];
  occurredAt: string;
}

export interface EmployeeObjectiveAlignmentOptionDto {
  type: ObjectiveAlignmentType;
  targetId: string;
  title: string;
  strategicObjectiveId: string | null;
  strategicObjectiveTitle: string | null;
}

export type EmployeeObjectiveWorkspaceState =
  | "entry-not-open"
  | "draft"
  | "submitted"
  | "changes-requested"
  | "approved"
  | "locked-approved"
  | "locked-unresolved"
  | "empty";

export interface EmployeeObjectivePlanWorkspaceDto {
  state: EmployeeObjectiveWorkspaceState;
  cycleId: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  launchedAt: string | null;
  planningLockedAt: string | null;
  planningLockedByName: string | null;
  maxObjectiveCount: number;
  allowedWeights: number[];
  enabledMeasurementMethods: string[];
  plan: EmployeeObjectivePlanDto | null;
  alignmentOptions: EmployeeObjectiveAlignmentOptionDto[];
  progress: PlanProgressDto | null;
  progressHistory: ObjectiveProgressUpdateDto[];
}

// ── Objective progress (Performance Record, partition 1) ─────────────

export type ObjectiveProgressState = "not-started" | "in-progress" | "completed";

export interface ObjectiveProgressAttachmentDto {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface ObjectiveProgressUpdateDto {
  id: string;
  objectiveId: string;
  progressPercent: number;
  previousPercent: number | null;
  actualValue: string | null;
  comment: string | null;
  isRegression: boolean;
  regressionReason: string | null;
  actorName: string;
  recordedAt: string;
  evidence: ObjectiveProgressAttachmentDto[];
}

export interface ObjectiveProgressStateDto {
  objectiveId: string;
  currentPercent: number;
  state: ObjectiveProgressState;
  isStale: boolean;
  lastUpdateAt: string | null;
  updateCount: number;
  lastActualValue: string | null;
}

export interface PlanProgressDto {
  weightedProgressPercent: number;
  objectiveCount: number;
  completedObjectiveCount: number;
  staleObjectiveCount: number;
  staleAfterDays: number;
  objectives: ObjectiveProgressStateDto[];
}

export interface RecordObjectiveProgressRequest {
  progressPercent: number;
  actualValue: string | null;
  comment: string | null;
  regressionConfirmed: boolean;
  regressionReason: string | null;
  attachmentIds: string[] | null;
}

export interface RecordObjectiveProgressResponseDto {
  recorded: boolean;
  outcome: "recorded" | "blocked" | "conflict";
  retryable: boolean;
  update: ObjectiveProgressUpdateDto | null;
  progress: PlanProgressDto | null;
  planVersion: number;
  blockingReasons: ObjectivePlanBlockingReasonDto[];
}

export interface SaveEmployeeObjectiveRequest {
  title: string;
  description: string | null;
  alignmentType: ObjectiveAlignmentType | null;
  alignmentTargetId: string | null;
  weight: number | null;
  deadline: string | null;
  measurementMethod: string | null;
  measurementIndicator: string | null;
  targetValue: string | null;
  targetUnit: string | null;
  successCriteria: string | null;
}

export interface ObjectivePlanBlockingReasonDto {
  code: string;
  message: string;
  objectiveId: string | null;
}

export interface SubmitObjectivePlanResponseDto {
  submitted: boolean;
  plan: EmployeeObjectivePlanDto;
  blockingReasons: ObjectivePlanBlockingReasonDto[];
}

// ── Plan approvals (P1.5) ───────────────────────────────────────────

export interface PlanApprovalCampaignDto {
  id: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  launchedAt: string | null;
  planningLockedAt: string | null;
  planningLockedByName: string | null;
  waitingForReviewCount: number;
  changesRequestedCount: number;
  approvedCount: number;
  dataIssueCount: number;
}

export interface PlanApprovalWorkspaceDto {
  cycleId: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  launchedAt: string | null;
  planningLockedAt: string | null;
  planningLockedByName: string | null;
  waitingForReviewCount: number;
  changesRequestedCount: number;
  approvedCount: number;
  dataIssueCount: number;
  plans: PlanApprovalReviewDto[];
}

export interface PlanApprovalReviewDto {
  planId: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  jobTitle: string | null;
  orgUnitName: string | null;
  status: EmployeeObjectivePlanStatus;
  reviewState: "waiting-for-review" | "changes-requested" | "approved" | "not-ready";
  objectiveCount: number;
  totalWeight: number;
  submittedAt: string | null;
  approvedAt: string | null;
  approvingManagerEmployeeId: string | null;
  approvingManagerName: string | null;
  lastReviewEventAt: string | null;
  lastChangeRequestComment: string | null;
  isSelfApprovalDataIssue: boolean;
  dataIssueMessage: string | null;
  version: number;
  objectives: EmployeeObjectiveDto[];
  reviewHistory: PlanReviewHistoryEventDto[];
}

export interface PlanReviewHistoryEventDto {
  id: string;
  type: PlanReviewEventType;
  actorEmployeeId: string;
  actorName: string;
  comment: string | null;
  referencedObjectiveIds: string[];
  occurredAt: string;
}

export interface RequestObjectivePlanChangesRequest {
  comment: string;
  referencedObjectiveIds?: string[];
}

// ── Team progress (Performance Record, partition 1) ─────────────────

export interface TeamProgressCampaignDto {
  id: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  launchedAt: string | null;
  planningLockedAt: string | null;
  participantCount: number;
  needsAttentionCount: number;
}

export interface TeamProgressParticipantDto {
  employeeId: string;
  employeeName: string;
  weightedProgressPercent: number;
  objectiveCount: number;
  completedObjectiveCount: number;
  staleObjectiveCount: number;
  hasRecentRegression: boolean;
  notStartedObjectiveCount: number;
  needsAttention: boolean;
  lastActivityAt: string | null;
  objectives: ObjectiveProgressStateDto[];
}

export interface TeamProgressWorkspaceDto {
  cycleId: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  launchedAt: string | null;
  planningLockedAt: string | null;
  staleAfterDays: number;
  participants: TeamProgressParticipantDto[];
}

export interface TeamProgressObjectiveDetailDto {
  objective: EmployeeObjectiveDto;
  state: ObjectiveProgressStateDto;
  history: ObjectiveProgressUpdateDto[];
}

export interface TeamProgressParticipantDetailDto {
  cycleId: string;
  slug: string;
  name: string;
  employeeId: string;
  employeeName: string;
  progress: PlanProgressDto;
  objectives: TeamProgressObjectiveDetailDto[];
}

// ── Cascade coverage (P1.3) ──────────────────────────────────────────

export interface CascadeCoverageCampaignDto {
  id: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  launchedAt: string | null;
}

export interface CoverageStrategicObjectiveDto {
  id: string;
  title: string;
  description: string | null;
  responsibleFunctionLabel: string | null;
  teamObjectiveCount: number;
}

export interface CoverageManagerDto {
  employeeId: string;
  name: string;
  scopeSize: number;
  teamObjectiveCount: number;
}

export interface CascadeCoverageDto {
  cycleId: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  launchedAt: string | null;
  activeStrategicObjectiveCount: number;
  coveredStrategicObjectiveCount: number;
  managerCount: number;
  managersWithTeamObjectivesCount: number;
  teamObjectiveCount: number;
  strategicObjectives: CoverageStrategicObjectiveDto[];
  managers: CoverageManagerDto[];
  teamObjectives: TeamObjectiveDto[];
}

// ── Planning completion and lock (P1.6) ─────────────────────────────

export type PlanningCompletionState =
  | "not-launched"
  | "actionable"
  | "blocked"
  | "ready-to-lock"
  | "locked";

export type PlanningCompletionParticipantStatus =
  | "not-started"
  | "draft"
  | "submitted"
  | "changes-requested"
  | "approved"
  | "excluded"
  | "blocked";

export interface PlanningCompletionWorkspaceDto {
  state: PlanningCompletionState;
  cycleId: string;
  slug: string;
  name: string;
  referenceYear: number | null;
  planningOpeningDate: string | null;
  employeeSubmissionDeadline: string | null;
  managerApprovalDeadline: string | null;
  expectedPlanningLockDate: string | null;
  launchedAt: string | null;
  planningLockedAt: string | null;
  planningLockedByName: string | null;
  version: number;
  summary: PlanningCompletionSummaryDto;
  remainingGroups: PlanningCompletionRemainingGroupDto[];
  participants: PlanningCompletionParticipantPageDto;
}

export interface PlanningCompletionSummaryDto {
  totalParticipants: number;
  approvedCount: number;
  excludedCount: number;
  remainingCount: number;
  notStartedCount: number;
  draftCount: number;
  submittedCount: number;
  changesRequestedCount: number;
  blockedCount: number;
  overdueCount: number;
  reminderNeededCount: number;
  isReadyToLock: boolean;
}

export interface PlanningCompletionRemainingGroupDto {
  code: string;
  label: string;
  count: number;
}

export interface PlanningCompletionParticipantPageDto {
  items: PlanningCompletionParticipantDto[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface PlanningCompletionParticipantDto {
  participantEmployeeId: string;
  employeeName: string;
  employeeKey: string | null;
  email: string | null;
  jobTitle: string | null;
  orgUnitName: string | null;
  status: PlanningCompletionParticipantStatus;
  statusLabel: string;
  isApproved: boolean;
  isExcluded: boolean;
  isBlocked: boolean;
  isOverdue: boolean;
  reminderNeeded: boolean;
  lastActivityAt: string | null;
  plan: PlanningCompletionPlanDto | null;
  frozenReviewer: PlanningCompletionReviewerDto;
  effectiveReviewer: PlanningCompletionReviewerDto;
  reviewerWasReassigned: boolean;
  exclusion: PlanningCompletionExclusionDto | null;
  blockers: PlanningCompletionBlockerDto[];
  overdueIndicators: PlanningCompletionOverdueDto[];
  lastReminder: PlanningCompletionReminderDto | null;
}

export interface PlanningCompletionParticipantDetailDto {
  participant: PlanningCompletionParticipantDto;
  reminderHistory: PlanningCompletionReminderDto[];
  reassignmentHistory: PlanningCompletionReassignmentDto[];
}

export interface PlanningCompletionPlanDto {
  planId: string;
  status: string;
  statusLabel: string;
  objectiveCount: number;
  totalWeight: number;
  submittedAt: string | null;
  approvedAt: string | null;
  version: number;
}

export interface PlanningCompletionReviewerDto {
  employeeId: string | null;
  name: string | null;
  isActive: boolean | null;
}

export interface PlanningCompletionBlockerDto {
  code: string;
  label: string;
}

export interface PlanningCompletionOverdueDto {
  code: string;
  label: string;
  deadline: string;
}

export interface PlanningCompletionExclusionDto {
  reason: string;
  excludedByName: string | null;
  excludedAt: string;
}

export interface PlanningCompletionReminderDto {
  id: string;
  targetEmployeeId: string;
  targetName: string;
  targetType: string;
  reason: string;
  recordedByName: string | null;
  recordedAt: string;
  notificationTriggered: boolean;
}

export interface PlanningCompletionReassignmentDto {
  id: string;
  previousApproverEmployeeId: string | null;
  previousApproverName: string | null;
  newApproverEmployeeId: string;
  newApproverName: string;
  reason: string;
  reassignedByName: string | null;
  reassignedAt: string;
}

export interface RecordPlanningReminderRequest {
  targetEmployeeId: string;
  targetType: string;
  reason: string;
  participantEmployeeId?: string | null;
  planId?: string | null;
  triggerNotification?: boolean;
}

export interface ReassignPlanningReviewerRequest {
  newApproverEmployeeId: string;
  reason: string;
}

export interface ExcludePlanningParticipantRequest {
  reason: string;
}

export interface LockPlanningRequest {
  confirmation: string;
}

// ── Check-ins & follow-up (Performance Record step 2) ─────────────────

export type CheckInStatus = "Planned" | "Completed" | "Cancelled";
export type FollowUpActionStatus = "Open" | "Completed" | "Cancelled";
export type DiscussionSignalStatus = "Open" | "ResolvedByCheckIn" | "Closed";
export type FollowUpActionOwnerKind = "Employee" | "Reviewer";

export interface CheckInLinkedObjectiveDto {
  objectiveId: string;
  objectiveTitle: string;
  wasDiscussed: boolean;
}

export interface CheckInRescheduleEntryDto {
  previousDate: string;
  previousTime: string | null;
  newDate: string;
  newTime: string | null;
  actorName: string;
  occurredAt: string;
}

export interface CheckInAddendumDto {
  id: string;
  authorName: string;
  text: string;
  createdAtUtc: string;
}

export interface CheckInResponseDto {
  text: string;
  createdAtUtc: string;
}

export interface FollowUpActionStatusEventDto {
  fromStatus: FollowUpActionStatus;
  toStatus: FollowUpActionStatus;
  actorName: string;
  note: string | null;
  occurredAt: string;
}

export interface FollowUpActionDto {
  id: string;
  checkInId: string;
  description: string;
  ownerKind: FollowUpActionOwnerKind;
  ownerEmployeeId: string;
  ownerName: string;
  dueDate: string;
  linkedObjectiveId: string | null;
  status: FollowUpActionStatus;
  isOverdue: boolean;
  resolutionNote: string | null;
  resolvedAt: string | null;
  version: number;
  statusEvents: FollowUpActionStatusEventDto[];
}

export interface DiscussionSignalDto {
  id: string;
  objectiveId: string;
  objectiveTitle: string;
  note: string | null;
  status: DiscussionSignalStatus;
  linkedCheckInId: string | null;
  resolvedByCheckInId: string | null;
  closeReason: string | null;
  raisedAt: string;
  resolvedAt: string | null;
}

export interface CheckInSummaryDto {
  id: string;
  cycleId: string;
  status: CheckInStatus;
  plannedDate: string;
  plannedTime: string | null;
  reason: string;
  isOverdue: boolean;
  linkedObjectiveCount: number;
  createdByReviewerName: string;
  completedAt: string | null;
  hasResponse: boolean;
  version: number;
}

export interface CheckInDetailDto {
  id: string;
  cycleId: string;
  employeeId: string;
  employeeName: string;
  createdByReviewerName: string;
  status: CheckInStatus;
  plannedDate: string;
  plannedTime: string | null;
  reason: string;
  agenda: string | null;
  isOverdue: boolean;
  version: number;
  completionSummary: string | null;
  completedByReviewerName: string | null;
  completedAt: string | null;
  cancellationReason: string | null;
  cancelledAt: string | null;
  linkedObjectives: CheckInLinkedObjectiveDto[];
  rescheduleHistory: CheckInRescheduleEntryDto[];
  addenda: CheckInAddendumDto[];
  response: CheckInResponseDto | null;
  actions: FollowUpActionDto[];
}

export interface CheckInParticipantPanelDto {
  employeeId: string;
  employeeName: string;
  openDiscussionSignals: DiscussionSignalDto[];
  upcoming: CheckInSummaryDto[];
  overdue: CheckInSummaryDto[];
  unresolvedActions: FollowUpActionDto[];
  completedHistory: CheckInSummaryDto[];
}

export interface EmployeeCheckInsDto {
  upcoming: CheckInSummaryDto[];
  completed: CheckInDetailDto[];
  assignedActions: FollowUpActionDto[];
  completedActions: FollowUpActionDto[];
  openDiscussionSignals: DiscussionSignalDto[];
}

export interface PlanCheckInRequest {
  employeeId: string;
  plannedDate: string;
  plannedTime: string | null;
  reason: string;
  agenda: string | null;
  linkedObjectiveIds: string[] | null;
  discussionSignalIds: string[] | null;
}

export interface RescheduleCheckInRequest {
  expectedVersion: number;
  newDate: string;
  newTime: string | null;
}

export interface CancelCheckInRequest {
  expectedVersion: number;
  reason: string;
}

export interface AgreedActionInput {
  description: string;
  ownerKind: FollowUpActionOwnerKind;
  dueDate: string;
  linkedObjectiveId: string | null;
}

export interface CompleteCheckInRequest {
  expectedVersion: number;
  summary: string;
  discussedObjectiveIds: string[] | null;
  actions: AgreedActionInput[] | null;
}

export interface AddCheckInAddendumRequest {
  text: string;
}

export interface CompleteFollowUpActionRequest {
  expectedVersion: number;
  note: string | null;
}

export interface CancelFollowUpActionRequest {
  expectedVersion: number;
  reason: string;
}

export interface RaiseDiscussionSignalRequest {
  objectiveId: string;
  note: string | null;
}

export interface CloseDiscussionSignalRequest {
  reason: string;
}

export interface AddCheckInEmployeeResponseRequest {
  text: string;
}

export interface CheckInMutationResult {
  checkInId: string;
  status: CheckInStatus;
  version: number;
}

export interface FollowUpActionMutationResult {
  actionId: string;
  status: FollowUpActionStatus;
  version: number;
}

export interface DiscussionSignalMutationResult {
  signalId: string;
  status: DiscussionSignalStatus;
}

// ── Paths ────────────────────────────────────────────────────────────

export const performancePaths = {
  cycles: () => "/performance/cycles",
  cycle: (id: string) => `/performance/cycles/${id}`,
  cycleBySlug: (slug: string) => `/performance/cycles/by-slug/${slug}`,
  cyclePopulation: (id: string) => `/performance/cycles/${id}/population`,
  cyclePopulationPreview: (id: string) =>
    `/performance/cycles/${id}/population/preview`,
  cycleLaunch: (id: string) => `/performance/cycles/${id}/launch`,
  cycleParticipants: (id: string) => `/performance/cycles/${id}/participants`,
  cycleAudit: (id: string) => `/performance/cycles/${id}/audit`,
  cycleReadiness: (id: string) => `/performance/cycles/${id}/readiness`,
  campaignStrategicObjectives: (id: string) =>
    `/performance/cycles/${id}/strategic-objectives`,
  campaignStrategicObjective: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/strategic-objectives/${objectiveId}`,
  campaignStrategicObjectiveActiveState: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/strategic-objectives/${objectiveId}/active-state`,
  cycleParticipantApprover: (cycleId: string, employeeId: string) =>
    `/performance/cycles/${cycleId}/participants/${employeeId}/approver`,
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
  myTeamObjectiveCampaigns: () => "/performance/team-objectives/my-campaigns",
  teamObjectiveWorkspace: (slug: string) =>
    `/performance/team-objectives/campaigns/${slug}`,
  teamObjectives: (cycleId: string) =>
    `/performance/team-objectives/campaigns/${cycleId}/objectives`,
  teamObjective: (cycleId: string, objectiveId: string) =>
    `/performance/team-objectives/campaigns/${cycleId}/objectives/${objectiveId}`,
  myObjectivePlanCampaigns: () => "/performance/employee-objectives/my-campaigns",
  employeeObjectiveWorkspace: (slug: string) =>
    `/performance/employee-objectives/campaigns/${slug}`,
  employeeObjectives: (cycleId: string) =>
    `/performance/employee-objectives/campaigns/${cycleId}/objectives`,
  employeeObjective: (cycleId: string, objectiveId: string) =>
    `/performance/employee-objectives/campaigns/${cycleId}/objectives/${objectiveId}`,
  employeeObjectivePlanSubmit: (cycleId: string) =>
    `/performance/employee-objectives/campaigns/${cycleId}/submit`,
  employeeObjectiveProgress: (cycleId: string, objectiveId: string) =>
    `/performance/employee-objectives/campaigns/${cycleId}/objectives/${objectiveId}/progress`,
  attachments: () => "/performance/attachments",
  attachment: (attachmentId: string) => `/performance/attachments/${attachmentId}`,
  myTeamProgressCampaigns: () => "/performance/team-progress/my-campaigns",
  teamProgressWorkspace: (slug: string) =>
    `/performance/team-progress/campaigns/${slug}`,
  teamProgressParticipant: (slug: string, employeeId: string) =>
    `/performance/team-progress/campaigns/${slug}/participants/${employeeId}`,
  myPlanApprovalCampaigns: () => "/performance/plan-approvals/my-campaigns",
  planApprovalWorkspace: (slug: string) =>
    `/performance/plan-approvals/campaigns/${slug}`,
  planApprovalApprove: (cycleId: string, planId: string) =>
    `/performance/plan-approvals/campaigns/${cycleId}/plans/${planId}/approve`,
  planApprovalRequestChanges: (cycleId: string, planId: string) =>
    `/performance/plan-approvals/campaigns/${cycleId}/plans/${planId}/request-changes`,
  cascadeCoverageCampaigns: () => "/performance/cascade-coverage/campaigns",
  cascadeCoverage: (slug: string) =>
    `/performance/cascade-coverage/campaigns/${slug}`,
  planningCompletionWorkspace: (slug: string) =>
    `/performance/planning-completion/campaigns/${slug}`,
  planningCompletionParticipant: (cycleId: string, participantEmployeeId: string) =>
    `/performance/planning-completion/campaigns/${cycleId}/participants/${participantEmployeeId}`,
  planningCompletionReminder: (cycleId: string) =>
    `/performance/planning-completion/campaigns/${cycleId}/reminders`,
  planningCompletionReassignReviewer: (cycleId: string, participantEmployeeId: string) =>
    `/performance/planning-completion/campaigns/${cycleId}/participants/${participantEmployeeId}/reassign-reviewer`,
  planningCompletionExcludeParticipant: (cycleId: string, participantEmployeeId: string) =>
    `/performance/planning-completion/campaigns/${cycleId}/participants/${participantEmployeeId}/exclude`,
  planningCompletionLock: (cycleId: string) =>
    `/performance/planning-completion/campaigns/${cycleId}/lock`,
  checkInParticipantPanel: (cycleId: string, employeeId: string) =>
    `/performance/check-ins/campaigns/${cycleId}/participants/${employeeId}`,
  checkInDetail: (checkInId: string) => `/performance/check-ins/${checkInId}`,
  myCheckIns: (cycleId: string) => `/performance/check-ins/mine?cycleId=${cycleId}`,
  planCheckIn: (cycleId: string) => `/performance/check-ins/campaigns/${cycleId}`,
  rescheduleCheckIn: (checkInId: string) =>
    `/performance/check-ins/${checkInId}/reschedule`,
  cancelCheckIn: (checkInId: string) => `/performance/check-ins/${checkInId}/cancel`,
  completeCheckIn: (checkInId: string) =>
    `/performance/check-ins/${checkInId}/complete`,
  addCheckInAddendum: (checkInId: string) =>
    `/performance/check-ins/${checkInId}/addendum`,
  completeFollowUpAction: (actionId: string) =>
    `/performance/check-ins/actions/${actionId}/complete`,
  cancelFollowUpAction: (actionId: string) =>
    `/performance/check-ins/actions/${actionId}/cancel`,
  addCheckInResponse: (checkInId: string) =>
    `/performance/check-ins/${checkInId}/response`,
  raiseDiscussionSignal: (cycleId: string) =>
    `/performance/check-ins/campaigns/${cycleId}/discussion-signals`,
  closeDiscussionSignal: (signalId: string) =>
    `/performance/check-ins/discussion-signals/${signalId}/close`,
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
  teamObjectives: () => [...performanceQueryKeys.all(), "team-objectives"] as const,
  myTeamObjectiveCampaigns: () =>
    [...performanceQueryKeys.teamObjectives(), "my-campaigns"] as const,
  teamObjectiveWorkspace: (slug: string) =>
    [...performanceQueryKeys.teamObjectives(), "workspace", slug] as const,
  myObjectives: () => [...performanceQueryKeys.all(), "my-objectives"] as const,
  myObjectivePlanCampaigns: () =>
    [...performanceQueryKeys.myObjectives(), "campaigns"] as const,
  employeeObjectiveWorkspace: (slug: string) =>
    [...performanceQueryKeys.myObjectives(), "workspace", slug] as const,
  teamProgress: () => [...performanceQueryKeys.all(), "team-progress"] as const,
  myTeamProgressCampaigns: () =>
    [...performanceQueryKeys.teamProgress(), "campaigns"] as const,
  teamProgressWorkspace: (slug: string) =>
    [...performanceQueryKeys.teamProgress(), "workspace", slug] as const,
  teamProgressParticipant: (slug: string, employeeId: string) =>
    [...performanceQueryKeys.teamProgress(), "participant", slug, employeeId] as const,
  planApprovals: () => [...performanceQueryKeys.all(), "plan-approvals"] as const,
  myPlanApprovalCampaigns: () =>
    [...performanceQueryKeys.planApprovals(), "campaigns"] as const,
  planApprovalWorkspace: (slug: string) =>
    [...performanceQueryKeys.planApprovals(), "workspace", slug] as const,
  cascadeCoverageAll: () =>
    [...performanceQueryKeys.all(), "cascade-coverage"] as const,
  cascadeCoverageCampaigns: () =>
    [...performanceQueryKeys.cascadeCoverageAll(), "campaigns"] as const,
  cascadeCoverage: (slug: string) =>
    [...performanceQueryKeys.cascadeCoverageAll(), slug] as const,
  planningCompletion: () =>
    [...performanceQueryKeys.all(), "planning-completion"] as const,
  planningCompletionWorkspace: (
    slug: string,
    params?: {
      status?: string | null;
      blocker?: string | null;
      overdue?: boolean | null;
      reminderNeeded?: boolean | null;
      approverEmployeeId?: string | null;
      search?: string | null;
      page?: number;
      pageSize?: number;
    },
  ) =>
    [
      ...performanceQueryKeys.planningCompletion(),
      "workspace",
      slug,
      {
        status: params?.status ?? null,
        blocker: params?.blocker ?? null,
        overdue: params?.overdue ?? null,
        reminderNeeded: params?.reminderNeeded ?? null,
        approverEmployeeId: params?.approverEmployeeId ?? null,
        search: params?.search?.trim() || null,
        page: params?.page ?? 1,
        pageSize: params?.pageSize ?? 50,
      },
    ] as const,
  planningCompletionParticipant: (cycleId: string, participantEmployeeId: string) =>
    [
      ...performanceQueryKeys.planningCompletion(),
      "participant",
      cycleId,
      participantEmployeeId,
    ] as const,
  checkIns: () => [...performanceQueryKeys.all(), "check-ins"] as const,
  checkInParticipantPanel: (cycleId: string, employeeId: string) =>
    [...performanceQueryKeys.checkIns(), "panel", cycleId, employeeId] as const,
  checkInDetail: (checkInId: string) =>
    [...performanceQueryKeys.checkIns(), "detail", checkInId] as const,
  myCheckIns: (cycleId: string) =>
    [...performanceQueryKeys.checkIns(), "mine", cycleId] as const,
} as const;
