import type { ApiClient } from "./types";

// ── Enumerations (mirror the Performance service contracts) ──────────────────

export type MeasurementMethod = "ManualPercentage" | "NumericTarget" | "WeightedMilestones";
export type ImprovementDirection = "Increase" | "Decrease";
export type CycleLifecycleState = "Draft" | "Active" | "Closed";
export type ObjectiveLifecycleState = "Draft" | "Published";
export type PopulationMode = "AllActive" | "ByScope";
export type ObjectiveOwnershipScope = "Company" | "OrgUnit" | "Employee";
export type ObjectiveProgressSource = "Direct" | "Calculated";
export type PlanLifecycleState = "Draft" | "Submitted" | "Approved";
export type PlanApprovalKind = "Normal" | "Exceptional";
export type PlanDecisionKind = "Submitted" | "Returned" | "Approved" | "ApprovedExceptionally";
export type ProgressEventKind = "PercentageSet" | "NumericActual" | "MilestoneCompleted" | "MilestoneReopened";
export type EvidenceKind = "File" | "Link" | "Reference";
export type ReadinessIssueCode = "InactiveEmployment" | "NoPrimaryAssignment" | "MissingManager";
export type OperationalMilestone =
  | "StrategicDirectionPublished"
  | "PopulationConfirmed"
  | "PlanningOpened"
  | "PlanningCompleted"
  | "PerformanceEndReached"
  | "ClosureReady";

// ── DTOs ─────────────────────────────────────────────────────────────────────

export interface PerformanceAccessDto {
  canEnter: boolean;
  canAdminister: boolean;
  canPublishStrategy: boolean;
  canParticipate: boolean;
  /** Holds the organizational-objective management grant (`objective.org.manage @Tenant`). In the
   *  direct MVP this is coarse tenant-wide authority; it governs whether to offer the "establish
   *  objective" affordance. The server still enforces the capability on every action. */
  canManageOrgObjectives: boolean;
  aggregateViewScope: string | null;
}

export interface CycleSettingsDto {
  defaultMeasurementMethod: MeasurementMethod;
  suggestedObjectiveCountMin: number;
  suggestedObjectiveCountMax: number;
  planningDeadlineOffsetDays: number;
  allowStandaloneObjectives: boolean;
}

export interface CycleSummaryDto {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  planningDeadline: string;
  state: CycleLifecycleState;
  activatedAt: string | null;
}

export interface MilestoneStateDto {
  milestone: OperationalMilestone;
  reached: boolean;
}

export interface LaunchReadinessAreaDto {
  key: string;
  label: string;
  complete: boolean;
  detail: string | null;
}

export interface LaunchReadinessDto {
  canActivate: boolean;
  areas: LaunchReadinessAreaDto[];
  blockers: string[];
}

export interface CycleDetailDto {
  cycle: CycleSummaryDto;
  launchReadiness: LaunchReadinessDto;
  milestones: MilestoneStateDto[];
  publishedStrategyCount: number;
  draftStrategyCount: number;
  populationConfirmed: boolean;
  confirmedParticipantCount: number;
}

export interface MilestoneDto {
  id: string;
  title: string;
  weight: number;
  dueDate: string | null;
  isCompleted: boolean;
}

export interface MeasurementDto {
  method: MeasurementMethod;
  baseline: number | null;
  target: number | null;
  unit: string | null;
  direction: ImprovementDirection | null;
  milestones: MilestoneDto[];
}

export interface StrategicObjectiveDto {
  id: string;
  title: string;
  description: string | null;
  accountablePersonId: string;
  accountablePersonName: string | null;
  startDate: string;
  endDate: string;
  state: ObjectiveLifecycleState;
  publishedAt: string | null;
  measurement: MeasurementDto;
}

export interface ReadinessIssueDto {
  code: ReadinessIssueCode;
  label: string;
  isHard: boolean;
}

export interface PopulationCandidateDto {
  employeeId: string;
  displayName: string;
  jobTitle: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  managerEmployeeId: string | null;
  managerDisplayName: string | null;
  isActive: boolean;
  byExplicitInclusion: boolean;
  isExcluded: boolean;
  exclusionReason: string | null;
  isEligible: boolean;
  countsToRoster: boolean;
  issues: ReadinessIssueDto[];
}

export interface OrgUnitSelectionInput {
  orgUnitId: string;
  includeDescendants: boolean;
}

export interface ExclusionInput {
  employeeId: string;
  reason: string;
}

export interface PopulationSelectionDto {
  mode: PopulationMode;
  eligibilityDate: string;
  isConfirmed: boolean;
  orgUnitSelections: OrgUnitSelectionInput[];
  inclusions: string[];
  exclusions: ExclusionInput[];
}

export interface PopulationDto {
  selection: PopulationSelectionDto;
  readyCount: number;
  needsAttentionCount: number;
  excludedCount: number;
  candidates: PopulationCandidateDto[];
}

// ── Organizational goals (Chunk B) ─────────────────────────────────────────────

export interface PersonRefDto {
  id: string;
  name: string | null;
}

export interface GoalNodeDto {
  id: string;
  ownershipScope: ObjectiveOwnershipScope;
  title: string;
  state: ObjectiveLifecycleState;
  parentObjectiveId: string | null;
  orgUnitId: string | null;
  orgUnitName: string | null;
  accountablePersonId: string;
  accountablePersonName: string | null;
  startDate: string;
  endDate: string;
  progressSource: ObjectiveProgressSource;
  measurementSummary: string;
  isAlignmentBaseline: boolean;
  isContributionBaselineLocked: boolean;
  contributionWeightTotal: number;
  childCount: number;
  contributorCount: number;
  contributionToParent: number | null;
}

export interface GoalsOverviewDto {
  cycleId: string;
  cycleName: string;
  cycleState: CycleLifecycleState;
  cycleStart: string;
  cycleEnd: string;
  strategicCount: number;
  organizationalCount: number;
  publishedCount: number;
  draftCount: number;
  nodes: GoalNodeDto[];
}

export interface ContributionLinkDto {
  childObjectiveId: string;
  childTitle: string;
  childState: ObjectiveLifecycleState;
  weight: number;
}

export interface GoalDetailDto {
  node: GoalNodeDto;
  description: string | null;
  accountable: PersonRefDto;
  parent: GoalNodeDto | null;
  children: GoalNodeDto[];
  measurement: MeasurementDto | null;
  contribution: ContributionLinkDto[];
  canEdit: boolean;
  canPublish: boolean;
  canConfigureContribution: boolean;
}

export interface CreateOrganizationalObjectiveRequest {
  orgUnitId: string;
  orgUnitName?: string | null;
  title: string;
  description?: string | null;
  accountablePersonId: string;
  parentObjectiveId: string;
  startDate?: string | null;
  endDate?: string | null;
  progressSource: ObjectiveProgressSource;
  measurement?: MeasurementInput | null;
}

export interface UpdateOrganizationalObjectiveRequest {
  title: string;
  description?: string | null;
  accountablePersonId: string;
  startDate: string;
  endDate: string;
  progressSource: ObjectiveProgressSource;
  measurement?: MeasurementInput | null;
}

export interface AlignObjectiveRequest {
  parentObjectiveId: string;
}

export interface ContributionInput {
  childObjectiveId: string;
  weight: number;
}

export interface ConfigureContributionRequest {
  contributors: ContributionInput[];
}

// ── Employee plans (Chunk C) ────────────────────────────────────────────────────

export interface PlanObjectiveDto {
  id: string;
  title: string;
  description: string | null;
  parentObjectiveId: string | null;
  /** Readable upstream direction, top-down (e.g. ["Grow the customer base", "Lift NPS to 60"]). Empty for standalone. */
  directionPath: string[];
  isAligned: boolean;
  startDate: string;
  endDate: string;
  progressSource: ObjectiveProgressSource;
  measurementSummary: string;
  measurement: MeasurementDto | null;
  planWeight: number | null;
  hasProgress: boolean;
  derivedProgress: number;
  /** Latest reported raw values — the current value the employee reads, distinct from derivedProgress. Null until progress exists. */
  currentPercentage: number | null;
  currentActual: number | null;
  lastProgressAt: string | null;
  canUpdateProgress: boolean;
}

export interface PlanReadinessDto {
  objectiveCount: number;
  weightTotal: number;
  /** Positive = still to assign, negative = over by that much, 0 = exactly 100%. */
  weightRemaining: number;
  everyObjectiveHasWeight: boolean;
  connectsToStrategicDirection: boolean;
  hasStandaloneObjective: boolean;
  standaloneAllowed: boolean;
  canSubmit: boolean;
  blockers: string[];
}

export interface PlanDecisionDto {
  kind: PlanDecisionKind;
  actorEmployeeId: string;
  actorName: string | null;
  feedback: string | null;
  decidedAt: string;
}

export interface EmployeePlanDto {
  id: string;
  cycleId: string;
  cycleName: string;
  cycleState: CycleLifecycleState;
  employee: PersonRefDto;
  orgUnitName: string | null;
  responsibleManager: PersonRefDto | null;
  state: PlanLifecycleState;
  submittedAt: string | null;
  lastSavedAt: string;
  approvedAt: string | null;
  approvalKind: PlanApprovalKind | null;
  isLocked: boolean;
  planProgress: number;
  objectives: PlanObjectiveDto[];
  readiness: PlanReadinessDto;
  history: PlanDecisionDto[];
  canAuthor: boolean;
  canSubmit: boolean;
  canDecide: boolean;
  canApproveExceptionally: boolean;
}

export interface PlanPreviewDto {
  reviewer: PersonRefDto | null;
  orgUnitName: string | null;
}

export interface MyPlanStateDto {
  participatesInCycle: boolean;
  hasPlan: boolean;
  plan: EmployeePlanDto | null;
  preview: PlanPreviewDto | null;
}

export interface AlignmentTargetDto {
  id: string;
  ownershipScope: ObjectiveOwnershipScope;
  title: string;
  orgUnitName: string | null;
  accountablePersonId: string;
  accountablePersonName: string | null;
  startDate: string;
  endDate: string;
  directionPath: string[];
}

export interface PlanReviewSummaryDto {
  id: string;
  employee: PersonRefDto;
  orgUnitName: string | null;
  state: PlanLifecycleState;
  objectiveCount: number;
  weightTotal: number;
  alignedCount: number;
  standaloneCount: number;
  submittedAt: string | null;
}

export interface PlanReviewListDto {
  cycleId: string;
  cycleName: string;
  awaitingDecisionCount: number;
  plans: PlanReviewSummaryDto[];
}

export interface AddPlanObjectiveRequest {
  title: string;
  description?: string | null;
  parentObjectiveId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  measurement: MeasurementInput;
  planWeight: number;
}

export type UpdatePlanObjectiveRequest = AddPlanObjectiveRequest;

export interface SetPlanWeightsRequest {
  weights: Array<{ objectiveId: string; weight: number }>;
}

export interface ReturnPlanRequest {
  feedback: string;
}

export interface ExceptionalApprovePlanRequest {
  reason: string;
}

// ── Progress & contribution (Chunk D) ───────────────────────────────────────────

export interface EvidenceDto {
  id: string;
  kind: EvidenceKind;
  fileName: string | null;
  contentType: string | null;
  sizeBytes: number | null;
  url: string | null;
  referenceText: string | null;
  /** Present only for a File the caller may open; null hides the action when unauthorized. */
  downloadPath: string | null;
}

export interface ProgressUpdateDto {
  id: string;
  kind: ProgressEventKind;
  value: number | null;
  milestoneId: string | null;
  milestoneTitle: string | null;
  contextNote: string | null;
  isCorrection: boolean;
  author: PersonRefDto;
  recordedAt: string;
  evidence: EvidenceDto[];
  /** Objective's derived progress immediately after this update. */
  resultingProgress: number;
  /** Signed change from the previous update (first update measured from an unstarted 0). */
  deltaProgress: number;
}

export interface ProgressHistoryPageDto {
  items: ProgressUpdateDto[];
  nextCursor: string | null;
}

export interface ProgressMilestoneDto {
  id: string;
  title: string;
  weight: number;
  isCompleted: boolean;
}

export interface ObjectiveProgressDto {
  objectiveId: string;
  title: string;
  ownershipScope: ObjectiveOwnershipScope;
  method: MeasurementMethod;
  hasProgress: boolean;
  derivedProgress: number;
  currentPercentage: number | null;
  currentActual: number | null;
  baseline: number | null;
  target: number | null;
  unit: string | null;
  direction: ImprovementDirection | null;
  milestones: ProgressMilestoneDto[];
  canUpdate: boolean;
  history: ProgressUpdateDto[];
  /** Cursor for the next older page of history; null when the first page holds all of it. */
  historyNextCursor: string | null;
}

export interface EvidenceDescriptorDto {
  storageKey: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface EvidenceInput {
  kind: EvidenceKind;
  storageKey?: string | null;
  fileName?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  url?: string | null;
  label?: string | null;
  referenceText?: string | null;
}

export interface SubmitProgressRequest {
  percentage?: number | null;
  numericActual?: number | null;
  milestoneId?: string | null;
  milestoneCompleted?: boolean | null;
  contextNote?: string | null;
  isCorrection: boolean;
  evidence?: EvidenceInput[] | null;
}

export interface ContributionNodeDto {
  id: string;
  ownershipScope: ObjectiveOwnershipScope;
  title: string;
  orgUnitName: string | null;
  accountablePersonId: string;
  accountablePersonName: string | null;
  progressSource: ObjectiveProgressSource;
  hasProgress: boolean;
  reportedProgress: number;
  coverage: number | null;
  childCount: number;
  contributorCount: number;
  contributionToParent: number | null;
}

export interface ContributionContributorDto {
  childObjectiveId: string;
  title: string;
  weight: number;
  hasProgress: boolean;
  reportedProgress: number;
}

export interface ContributionOverviewDto {
  cycleId: string;
  cycleName: string;
  roots: ContributionNodeDto[];
}

export interface ContributionDetailDto {
  node: ContributionNodeDto;
  description: string | null;
  trail: ContributionNodeDto[];
  children: ContributionNodeDto[];
  contributors: ContributionContributorDto[];
}

// ── Request bodies ────────────────────────────────────────────────────────────

export interface CreateCycleRequest {
  name: string;
  startDate: string;
  endDate: string;
  planningDeadline?: string | null;
}

export interface UpdateCycleRequest {
  name: string;
  startDate: string;
  endDate: string;
  planningDeadline: string;
}

export interface MeasurementInput {
  method: MeasurementMethod;
  baseline?: number | null;
  target?: number | null;
  unit?: string | null;
  direction?: ImprovementDirection | null;
  milestones?: Array<{ title: string; weight: number; dueDate?: string | null }> | null;
}

export interface CreateStrategicObjectiveRequest {
  title: string;
  description?: string | null;
  accountablePersonId: string;
  startDate?: string | null;
  endDate?: string | null;
  measurement: MeasurementInput;
}

export interface UpdateStrategicObjectiveRequest {
  title: string;
  description?: string | null;
  accountablePersonId: string;
  startDate: string;
  endDate: string;
  measurement: MeasurementInput;
}

export interface SetPopulationRequest {
  mode: PopulationMode;
  orgUnitSelections?: OrgUnitSelectionInput[];
  inclusions?: string[];
  exclusions?: ExclusionInput[];
}

// ── Paths & query keys ─────────────────────────────────────────────────────────

export const performancePaths = {
  access: () => "/performance/access",
  settings: () => "/performance/settings",
  cycles: () => "/performance/cycles",
  currentCycle: () => "/performance/cycles/current",
  cycle: (id: string) => `/performance/cycles/${id}`,
  activate: (id: string) => `/performance/cycles/${id}/activate`,
  strategy: (cycleId: string) => `/performance/cycles/${cycleId}/strategy`,
  strategyItem: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/strategy/${objectiveId}`,
  publishStrategy: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/strategy/${objectiveId}/publish`,
  population: (cycleId: string) => `/performance/cycles/${cycleId}/population`,
  confirmPopulation: (cycleId: string) => `/performance/cycles/${cycleId}/population/confirm`,
  goals: (cycleId: string) => `/performance/cycles/${cycleId}/goals`,
  goal: (cycleId: string, objectiveId: string) => `/performance/cycles/${cycleId}/goals/${objectiveId}`,
  alignGoal: (cycleId: string, objectiveId: string) => `/performance/cycles/${cycleId}/goals/${objectiveId}/align`,
  publishGoal: (cycleId: string, objectiveId: string) => `/performance/cycles/${cycleId}/goals/${objectiveId}/publish`,
  goalContribution: (cycleId: string, objectiveId: string) => `/performance/cycles/${cycleId}/goals/${objectiveId}/contribution`,
  lockGoalContribution: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/goals/${objectiveId}/contribution/lock`,
  myPlan: (cycleId: string) => `/performance/cycles/${cycleId}/plan`,
  alignmentTargets: (cycleId: string) => `/performance/cycles/${cycleId}/plan/alignment-targets`,
  planObjectives: (cycleId: string) => `/performance/cycles/${cycleId}/plan/objectives`,
  planObjective: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/plan/objectives/${objectiveId}`,
  planWeights: (cycleId: string) => `/performance/cycles/${cycleId}/plan/weights`,
  submitPlan: (cycleId: string) => `/performance/cycles/${cycleId}/plan/submit`,
  planReviews: (cycleId: string) => `/performance/cycles/${cycleId}/plans/reviews`,
  planDetail: (cycleId: string, planId: string) => `/performance/cycles/${cycleId}/plans/${planId}`,
  returnPlan: (cycleId: string, planId: string) => `/performance/cycles/${cycleId}/plans/${planId}/return`,
  approvePlan: (cycleId: string, planId: string) => `/performance/cycles/${cycleId}/plans/${planId}/approve`,
  exceptionalApprovePlan: (cycleId: string, planId: string) =>
    `/performance/cycles/${cycleId}/plans/${planId}/exceptional-approve`,
  objectiveProgress: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/objectives/${objectiveId}/progress`,
  objectiveProgressHistory: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/objectives/${objectiveId}/progress/history`,
  evidenceUpload: (cycleId: string) => `/performance/cycles/${cycleId}/evidence/upload`,
  evidenceDownload: (cycleId: string, evidenceId: string) => `/performance/cycles/${cycleId}/evidence/${evidenceId}`,
  contribution: (cycleId: string) => `/performance/cycles/${cycleId}/contribution`,
  contributionDetail: (cycleId: string, objectiveId: string) =>
    `/performance/cycles/${cycleId}/contribution/${objectiveId}`,
} as const;

export const performanceQueryKeys = {
  all: () => ["performance"] as const,
  access: () => [...performanceQueryKeys.all(), "access"] as const,
  settings: () => [...performanceQueryKeys.all(), "settings"] as const,
  cycles: () => [...performanceQueryKeys.all(), "cycles"] as const,
  currentCycle: () => [...performanceQueryKeys.all(), "cycle", "current"] as const,
  cycle: (id: string) => [...performanceQueryKeys.all(), "cycle", id] as const,
  strategy: (cycleId: string) => [...performanceQueryKeys.all(), "strategy", cycleId] as const,
  population: (cycleId: string) => [...performanceQueryKeys.all(), "population", cycleId] as const,
  goals: (cycleId: string) => [...performanceQueryKeys.all(), "goals", cycleId] as const,
  goal: (cycleId: string, objectiveId: string) =>
    [...performanceQueryKeys.all(), "goal", cycleId, objectiveId] as const,
  myPlan: (cycleId: string) => [...performanceQueryKeys.all(), "my-plan", cycleId] as const,
  alignmentTargets: (cycleId: string) => [...performanceQueryKeys.all(), "alignment-targets", cycleId] as const,
  planReviews: (cycleId: string) => [...performanceQueryKeys.all(), "plan-reviews", cycleId] as const,
  planDetail: (cycleId: string, planId: string) =>
    [...performanceQueryKeys.all(), "plan", cycleId, planId] as const,
  objectiveProgress: (cycleId: string, objectiveId: string) =>
    [...performanceQueryKeys.all(), "progress", cycleId, objectiveId] as const,
  contribution: (cycleId: string) => [...performanceQueryKeys.all(), "contribution", cycleId] as const,
  contributionDetail: (cycleId: string, objectiveId: string) =>
    [...performanceQueryKeys.all(), "contribution", cycleId, objectiveId] as const,
} as const;

/** Performance Cycle & Goals transport. UI state and cache behavior remain feature-owned. */
export function createPerformanceApi(client: ApiClient) {
  return {
    access: (signal?: AbortSignal) =>
      client.get<PerformanceAccessDto>(performancePaths.access(), { signal }),

    getSettings: (signal?: AbortSignal) =>
      client.get<CycleSettingsDto>(performancePaths.settings(), { signal }),
    updateSettings: (request: CycleSettingsDto) =>
      client.put<CycleSettingsDto>(performancePaths.settings(), request),

    listCycles: (signal?: AbortSignal) =>
      client.get<CycleSummaryDto[]>(performancePaths.cycles(), { signal }),
    /** The primary/current Cycle's composed detail, or null when none exists. */
    getCurrentCycle: (signal?: AbortSignal) =>
      client.get<CycleDetailDto | null>(performancePaths.currentCycle(), { signal }),
    getCycle: (id: string, signal?: AbortSignal) =>
      client.get<CycleDetailDto>(performancePaths.cycle(id), { signal }),
    createCycle: (request: CreateCycleRequest) =>
      client.post<CycleSummaryDto>(performancePaths.cycles(), request),
    updateCycle: (id: string, request: UpdateCycleRequest) =>
      client.put<CycleSummaryDto>(performancePaths.cycle(id), request),
    activateCycle: (id: string) =>
      client.post<CycleDetailDto>(performancePaths.activate(id), {}),

    listStrategy: (cycleId: string, signal?: AbortSignal) =>
      client.get<StrategicObjectiveDto[]>(performancePaths.strategy(cycleId), { signal }),
    createStrategy: (cycleId: string, request: CreateStrategicObjectiveRequest) =>
      client.post<StrategicObjectiveDto>(performancePaths.strategy(cycleId), request),
    updateStrategy: (cycleId: string, objectiveId: string, request: UpdateStrategicObjectiveRequest) =>
      client.put<StrategicObjectiveDto>(performancePaths.strategyItem(cycleId, objectiveId), request),
    publishStrategy: (cycleId: string, objectiveId: string) =>
      client.post<StrategicObjectiveDto>(performancePaths.publishStrategy(cycleId, objectiveId), {}),
    deleteStrategy: (cycleId: string, objectiveId: string) =>
      client.delete<boolean>(performancePaths.strategyItem(cycleId, objectiveId)),

    getPopulation: (cycleId: string, signal?: AbortSignal) =>
      client.get<PopulationDto>(performancePaths.population(cycleId), { signal }),
    setPopulation: (cycleId: string, request: SetPopulationRequest) =>
      client.put<PopulationDto>(performancePaths.population(cycleId), request),
    confirmPopulation: (cycleId: string) =>
      client.post<PopulationDto>(performancePaths.confirmPopulation(cycleId), {}),

    getGoals: (cycleId: string, signal?: AbortSignal) =>
      client.get<GoalsOverviewDto>(performancePaths.goals(cycleId), { signal }),
    getGoal: (cycleId: string, objectiveId: string, signal?: AbortSignal) =>
      client.get<GoalDetailDto>(performancePaths.goal(cycleId, objectiveId), { signal }),
    createGoal: (cycleId: string, request: CreateOrganizationalObjectiveRequest) =>
      client.post<GoalDetailDto>(performancePaths.goals(cycleId), request),
    updateGoal: (cycleId: string, objectiveId: string, request: UpdateOrganizationalObjectiveRequest) =>
      client.put<GoalDetailDto>(performancePaths.goal(cycleId, objectiveId), request),
    alignGoal: (cycleId: string, objectiveId: string, request: AlignObjectiveRequest) =>
      client.post<GoalDetailDto>(performancePaths.alignGoal(cycleId, objectiveId), request),
    publishGoal: (cycleId: string, objectiveId: string) =>
      client.post<GoalDetailDto>(performancePaths.publishGoal(cycleId, objectiveId), {}),
    configureGoalContribution: (cycleId: string, objectiveId: string, request: ConfigureContributionRequest) =>
      client.put<GoalDetailDto>(performancePaths.goalContribution(cycleId, objectiveId), request),
    lockGoalContribution: (cycleId: string, objectiveId: string) =>
      client.post<GoalDetailDto>(performancePaths.lockGoalContribution(cycleId, objectiveId), {}),
    deleteGoal: (cycleId: string, objectiveId: string) =>
      client.delete<boolean>(performancePaths.goal(cycleId, objectiveId)),

    // Employee plans (Chunk C)
    getMyPlan: (cycleId: string, signal?: AbortSignal) =>
      client.get<MyPlanStateDto>(performancePaths.myPlan(cycleId), { signal }),
    getAlignmentTargets: (cycleId: string, signal?: AbortSignal) =>
      client.get<AlignmentTargetDto[]>(performancePaths.alignmentTargets(cycleId), { signal }),
    createMyPlan: (cycleId: string) =>
      client.post<EmployeePlanDto>(performancePaths.myPlan(cycleId), {}),
    addPlanObjective: (cycleId: string, request: AddPlanObjectiveRequest) =>
      client.post<EmployeePlanDto>(performancePaths.planObjectives(cycleId), request),
    updatePlanObjective: (cycleId: string, objectiveId: string, request: UpdatePlanObjectiveRequest) =>
      client.put<EmployeePlanDto>(performancePaths.planObjective(cycleId, objectiveId), request),
    removePlanObjective: (cycleId: string, objectiveId: string) =>
      client.delete<EmployeePlanDto>(performancePaths.planObjective(cycleId, objectiveId)),
    setPlanWeights: (cycleId: string, request: SetPlanWeightsRequest) =>
      client.put<EmployeePlanDto>(performancePaths.planWeights(cycleId), request),
    submitPlan: (cycleId: string) =>
      client.post<EmployeePlanDto>(performancePaths.submitPlan(cycleId), {}),
    getPlanReviews: (cycleId: string, signal?: AbortSignal) =>
      client.get<PlanReviewListDto>(performancePaths.planReviews(cycleId), { signal }),
    getPlanDetail: (cycleId: string, planId: string, signal?: AbortSignal) =>
      client.get<EmployeePlanDto>(performancePaths.planDetail(cycleId, planId), { signal }),
    returnPlan: (cycleId: string, planId: string, request: ReturnPlanRequest) =>
      client.post<EmployeePlanDto>(performancePaths.returnPlan(cycleId, planId), request),
    approvePlan: (cycleId: string, planId: string) =>
      client.post<EmployeePlanDto>(performancePaths.approvePlan(cycleId, planId), {}),
    exceptionalApprovePlan: (cycleId: string, planId: string, request: ExceptionalApprovePlanRequest) =>
      client.post<EmployeePlanDto>(performancePaths.exceptionalApprovePlan(cycleId, planId), request),

    // Progress & contribution (Chunk D)
    getObjectiveProgress: (cycleId: string, objectiveId: string, signal?: AbortSignal) =>
      client.get<ObjectiveProgressDto>(performancePaths.objectiveProgress(cycleId, objectiveId), { signal }),
    getObjectiveProgressHistory: (cycleId: string, objectiveId: string, cursor: string | null, limit?: number, signal?: AbortSignal) => {
      const params = new URLSearchParams();
      if (cursor) params.set("cursor", cursor);
      if (limit) params.set("limit", String(limit));
      const qs = params.toString();
      const base = performancePaths.objectiveProgressHistory(cycleId, objectiveId);
      return client.get<ProgressHistoryPageDto>(qs ? `${base}?${qs}` : base, { signal });
    },
    submitProgress: (cycleId: string, objectiveId: string, request: SubmitProgressRequest) =>
      client.post<ObjectiveProgressDto>(performancePaths.objectiveProgress(cycleId, objectiveId), request),
    uploadEvidence: (cycleId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      return client.post<EvidenceDescriptorDto>(performancePaths.evidenceUpload(cycleId), form);
    },
    evidenceDownloadPath: (cycleId: string, evidenceId: string) =>
      performancePaths.evidenceDownload(cycleId, evidenceId),
    /** Fetches a file-evidence item as a Blob with auth attached — a plain link cannot carry the bearer token. */
    downloadEvidence: (cycleId: string, evidenceId: string, signal?: AbortSignal) =>
      client.get<Blob>(performancePaths.evidenceDownload(cycleId, evidenceId), { responseType: "blob", signal }),
    getContribution: (cycleId: string, signal?: AbortSignal) =>
      client.get<ContributionOverviewDto>(performancePaths.contribution(cycleId), { signal }),
    getContributionDetail: (cycleId: string, objectiveId: string, signal?: AbortSignal) =>
      client.get<ContributionDetailDto>(performancePaths.contributionDetail(cycleId, objectiveId), { signal }),
  };
}

export type PerformanceApi = ReturnType<typeof createPerformanceApi>;
