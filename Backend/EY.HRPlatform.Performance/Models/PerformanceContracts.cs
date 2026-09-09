using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Progress;

namespace EY.HRPlatform.Performance.Models;

// ----- Access / capabilities (hide, don't deny) -----

public sealed record PerformanceAccessDto(
    bool CanEnter,
    bool CanAdminister,
    bool CanPublishStrategy,
    bool CanParticipate,
    bool CanManageOrgObjectives,
    string? AggregateViewScope);

// ----- Settings -----

public sealed record CycleSettingsDto(
    MeasurementMethod DefaultMeasurementMethod,
    int SuggestedObjectiveCountMin,
    int SuggestedObjectiveCountMax,
    int PlanningDeadlineOffsetDays,
    bool AllowStandaloneObjectives);

public sealed record UpdateCycleSettingsRequest(
    MeasurementMethod DefaultMeasurementMethod,
    int SuggestedObjectiveCountMin,
    int SuggestedObjectiveCountMax,
    int PlanningDeadlineOffsetDays,
    bool AllowStandaloneObjectives);

// ----- Cycles -----

public sealed record CycleSummaryDto(
    Guid Id,
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    DateOnly PlanningDeadline,
    CycleLifecycleState State,
    DateTime? ActivatedAt);

public sealed record CreateCycleRequest(
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    DateOnly? PlanningDeadline);

public sealed record UpdateCycleRequest(
    string Name,
    DateOnly StartDate,
    DateOnly EndDate,
    DateOnly PlanningDeadline);

public sealed record MilestoneStateDto(OperationalMilestone Milestone, bool Reached);

public sealed record LaunchReadinessAreaDto(string Key, string Label, bool Complete, string? Detail);

public sealed record LaunchReadinessDto(
    bool CanActivate,
    IReadOnlyList<LaunchReadinessAreaDto> Areas,
    IReadOnlyList<string> Blockers);

public sealed record CycleDetailDto(
    CycleSummaryDto Cycle,
    LaunchReadinessDto LaunchReadiness,
    IReadOnlyList<MilestoneStateDto> Milestones,
    int PublishedStrategyCount,
    int DraftStrategyCount,
    bool PopulationConfirmed,
    int ConfirmedParticipantCount);

// ----- Strategic direction -----

public sealed record MilestoneInput(string Title, decimal Weight, DateOnly? DueDate);

public sealed record MeasurementInput(
    MeasurementMethod Method,
    decimal? Baseline,
    decimal? Target,
    string? Unit,
    ImprovementDirection? Direction,
    IReadOnlyList<MilestoneInput>? Milestones);

public sealed record MilestoneDto(Guid Id, string Title, decimal Weight, DateOnly? DueDate, bool IsCompleted);

public sealed record MeasurementDto(
    MeasurementMethod Method,
    decimal? Baseline,
    decimal? Target,
    string? Unit,
    ImprovementDirection? Direction,
    IReadOnlyList<MilestoneDto> Milestones);

public sealed record StrategicObjectiveDto(
    Guid Id,
    string Title,
    string? Description,
    Guid AccountablePersonId,
    string? AccountablePersonName,
    DateOnly StartDate,
    DateOnly EndDate,
    ObjectiveLifecycleState State,
    DateTime? PublishedAt,
    MeasurementDto Measurement);

public sealed record CreateStrategicObjectiveRequest(
    string Title,
    string? Description,
    Guid AccountablePersonId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    MeasurementInput Measurement);

public sealed record UpdateStrategicObjectiveRequest(
    string Title,
    string? Description,
    Guid AccountablePersonId,
    DateOnly StartDate,
    DateOnly EndDate,
    MeasurementInput Measurement);

// ----- Population -----

public sealed record OrgUnitSelectionInput(Guid OrgUnitId, bool IncludeDescendants);

public sealed record ExclusionInput(Guid EmployeeId, string Reason);

public sealed record SetPopulationRequest(
    PopulationMode Mode,
    IReadOnlyList<OrgUnitSelectionInput>? OrgUnitSelections,
    IReadOnlyList<Guid>? Inclusions,
    IReadOnlyList<ExclusionInput>? Exclusions);

public sealed record ReadinessIssueDto(ReadinessIssueCode Code, string Label, bool IsHard);

public sealed record PopulationCandidateDto(
    Guid EmployeeId,
    string DisplayName,
    string? JobTitle,
    Guid? OrgUnitId,
    string? OrgUnitName,
    Guid? ManagerEmployeeId,
    string? ManagerDisplayName,
    bool IsActive,
    bool ByExplicitInclusion,
    bool IsExcluded,
    string? ExclusionReason,
    bool IsEligible,
    bool CountsToRoster,
    IReadOnlyList<ReadinessIssueDto> Issues);

public sealed record PopulationSelectionDto(
    PopulationMode Mode,
    DateOnly EligibilityDate,
    bool IsConfirmed,
    IReadOnlyList<OrgUnitSelectionInput> OrgUnitSelections,
    IReadOnlyList<Guid> Inclusions,
    IReadOnlyList<ExclusionInput> Exclusions);

public sealed record PopulationDto(
    PopulationSelectionDto Selection,
    int ReadyCount,
    int NeedsAttentionCount,
    int ExcludedCount,
    IReadOnlyList<PopulationCandidateDto> Candidates);

// ----- Organizational goals (Chunk B) -----

/// <summary>A person reference resolved from the Core snapshot for display.</summary>
public sealed record PersonRefDto(Guid Id, string? Name);

/// <summary>
/// One objective in the alignment graph — the shared node shape for the Alignment Map and the
/// List. Carries only what the map needs; full context comes from the detail read model.
/// </summary>
public sealed record GoalNodeDto(
    Guid Id,
    ObjectiveOwnershipScope OwnershipScope,
    string Title,
    ObjectiveLifecycleState State,
    Guid? ParentObjectiveId,
    Guid? OrgUnitId,
    string? OrgUnitName,
    Guid AccountablePersonId,
    string? AccountablePersonName,
    DateOnly StartDate,
    DateOnly EndDate,
    ObjectiveProgressSource ProgressSource,
    string MeasurementSummary,
    bool IsAlignmentBaseline,
    bool IsContributionBaselineLocked,
    decimal ContributionWeightTotal,
    int ChildCount,
    int ContributorCount,
    // This node's contribution weight to its parent, if the parent counts it as a contributor.
    decimal? ContributionToParent,
    // When this objective was published as direction; null while it is still a Draft.
    DateTime? PublishedAt,
    // Creation and last-edit timestamps — used to show a Draft's "saved" date.
    DateTime CreatedAt,
    DateTime? UpdatedAt);

/// <summary>The whole cycle's objective graph plus operational counts for the Goals area.</summary>
public sealed record GoalsOverviewDto(
    Guid CycleId,
    string CycleName,
    CycleLifecycleState CycleState,
    DateOnly CycleStart,
    DateOnly CycleEnd,
    int StrategicCount,
    int OrganizationalCount,
    int PublishedCount,
    int DraftCount,
    IReadOnlyList<GoalNodeDto> Nodes);

public sealed record ContributionLinkDto(
    Guid ChildObjectiveId,
    string ChildTitle,
    ObjectiveLifecycleState ChildState,
    decimal Weight);

/// <summary>The full context surface for one objective — summary, alignment, contribution.</summary>
public sealed record GoalDetailDto(
    GoalNodeDto Node,
    string? Description,
    PersonRefDto Accountable,
    GoalNodeDto? Parent,
    IReadOnlyList<GoalNodeDto> Children,
    MeasurementDto? Measurement,
    IReadOnlyList<ContributionLinkDto> Contribution,
    // What the current caller may do on this objective, resolved server-side (hide, don't deny).
    bool CanEdit,
    bool CanPublish,
    bool CanConfigureContribution);

public sealed record CreateOrganizationalObjectiveRequest(
    Guid OrgUnitId,
    string? OrgUnitName,
    string Title,
    string? Description,
    Guid AccountablePersonId,
    Guid ParentObjectiveId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    ObjectiveProgressSource ProgressSource,
    MeasurementInput? Measurement);

public sealed record UpdateOrganizationalObjectiveRequest(
    string Title,
    string? Description,
    Guid AccountablePersonId,
    DateOnly StartDate,
    DateOnly EndDate,
    ObjectiveProgressSource ProgressSource,
    MeasurementInput? Measurement);

public sealed record AlignObjectiveRequest(Guid ParentObjectiveId);

public sealed record ContributionInput(Guid ChildObjectiveId, decimal Weight);

public sealed record ConfigureContributionRequest(IReadOnlyList<ContributionInput> Contributors);

// ----- Employee plans (Chunk C) -----

/// <summary>
/// One objective in an employee plan. Carries its plan weight, its measurement, and the upstream
/// direction it aligns to (as readable labels Company › strategic › organizational), so the plan
/// makes alignment understandable without a bare parent id. Standalone role objectives carry no
/// parent and an empty direction path.
/// </summary>
public sealed record PlanObjectiveDto(
    Guid Id,
    string Title,
    string? Description,
    Guid? ParentObjectiveId,
    // Readable upstream direction, top-down (e.g. ["Grow the customer base", "Lift NPS to 60"]). Empty for standalone.
    IReadOnlyList<string> DirectionPath,
    bool IsAligned,
    DateOnly StartDate,
    DateOnly EndDate,
    ObjectiveProgressSource ProgressSource,
    string MeasurementSummary,
    MeasurementDto? Measurement,
    decimal? PlanWeight,
    // Progress (Chunk D) — meaningful once the plan is locked.
    bool HasProgress,
    decimal DerivedProgress,
    // Latest reported measurement values, straight from the domain — the raw current value read the
    // employee sees, distinct from DerivedProgress. Null until a progress event exists.
    decimal? CurrentPercentage,
    decimal? CurrentActual,
    DateTime? LastProgressAt,
    bool CanUpdateProgress);

/// <summary>Live readiness of a plan for submission — the whole-plan invariants, computed continuously.</summary>
public sealed record PlanReadinessDto(
    int ObjectiveCount,
    decimal WeightTotal,
    // Positive = still to assign, negative = over by that much, 0 = exactly 100%.
    decimal WeightRemaining,
    bool EveryObjectiveHasWeight,
    bool ConnectsToStrategicDirection,
    bool HasStandaloneObjective,
    bool StandaloneAllowed,
    bool CanSubmit,
    IReadOnlyList<string> Blockers);

public sealed record PlanDecisionDto(
    PlanDecisionKind Kind,
    Guid ActorEmployeeId,
    string? ActorName,
    string? Feedback,
    DateTime DecidedAt);

/// <summary>The full employee-plan surface — objectives, readiness, agreement history, and caller capabilities.</summary>
public sealed record EmployeePlanDto(
    Guid Id,
    Guid CycleId,
    string CycleName,
    CycleLifecycleState CycleState,
    PersonRefDto Employee,
    string? OrgUnitName,
    PersonRefDto? ResponsibleManager,
    PlanLifecycleState State,
    DateTime? SubmittedAt,
    DateTime LastSavedAt,
    DateTime? ApprovedAt,
    PlanApprovalKind? ApprovalKind,
    bool IsLocked,
    // Derived Plan progress over the locked objectives (Chunk D); labeled Plan progress, never a rating.
    decimal PlanProgress,
    IReadOnlyList<PlanObjectiveDto> Objectives,
    PlanReadinessDto Readiness,
    IReadOnlyList<PlanDecisionDto> History,
    // Caller capabilities, resolved server-side (hide, don't deny).
    bool CanAuthor,
    bool CanSubmit,
    bool CanDecide,
    bool CanApproveExceptionally);

/// <summary>Whether the caller has a plan in this Cycle yet, and the plan if so. When the caller
/// participates but has not started a plan, <see cref="Preview"/> carries the reviewer and scope
/// drawn from their participant baseline so the not-started surface can name them before authoring.</summary>
public sealed record MyPlanStateDto(
    bool ParticipatesInCycle,
    bool HasPlan,
    EmployeePlanDto? Plan,
    PlanPreviewDto? Preview = null);

/// <summary>The reviewer and scope an employee will plan against, resolved from their participant baseline before a plan exists.</summary>
public sealed record PlanPreviewDto(
    PersonRefDto? Reviewer,
    string? OrgUnitName);

/// <summary>One alignable upstream objective an employee objective may connect to (published strategic or approved organizational).</summary>
public sealed record AlignmentTargetDto(
    Guid Id,
    ObjectiveOwnershipScope OwnershipScope,
    string Title,
    string? OrgUnitName,
    Guid AccountablePersonId,
    string? AccountablePersonName,
    DateOnly StartDate,
    DateOnly EndDate,
    // Readable direction path down to and including this objective.
    IReadOnlyList<string> DirectionPath);

/// <summary>A manager's or administrator's review-queue row for a submitted plan awaiting decision.</summary>
public sealed record PlanReviewSummaryDto(
    Guid Id,
    PersonRefDto Employee,
    string? OrgUnitName,
    PlanLifecycleState State,
    int ObjectiveCount,
    decimal WeightTotal,
    int AlignedCount,
    int StandaloneCount,
    DateTime? SubmittedAt);

public sealed record PlanReviewListDto(
    Guid CycleId,
    string CycleName,
    int AwaitingDecisionCount,
    IReadOnlyList<PlanReviewSummaryDto> Plans);

/// <summary>
/// The lifecycle position of a roster member's plan as the manager reads it. Combines the plan
/// aggregate's lifecycle with two presentation distinctions the roster needs: a participant with no
/// plan yet (<see cref="NotStarted"/>), and a Draft whose most recent decision was a return, which the
/// employee now owns again (<see cref="ReturnedForChanges"/>). Never a fabricated status — each is
/// derived from real plan state.
/// </summary>
public enum RosterPlanStatus
{
    NotStarted = 0,
    Draft = 1,
    ReturnedForChanges = 2,
    Submitted = 3,
    Approved = 4,
}

/// <summary>
/// The kind of the single most-recent meaningful event on a roster member's plan, so the manager reads
/// a submission date and a progress-update date as the distinct concepts they are. <see cref="None"/>
/// covers a member with no reportable activity (no plan, or an approved plan not yet reporting progress).
/// </summary>
public enum RosterActivityKind
{
    None = 0,
    DraftUpdated = 1,
    Returned = 2,
    Submitted = 3,
    ProgressUpdated = 4,
}

/// <summary>
/// One row of the manager's people roster for a Cycle — a participant enriched with their plan's real
/// lifecycle, execution facts, latest activity, and the caller's actual action authority. Roster
/// membership (the manager/report relationship) is deliberately distinct from decision authority
/// (<see cref="CanReview"/>): being a report does not by itself grant plan-decision capability.
/// </summary>
public sealed record TeamRosterMemberDto(
    Guid EmployeeId,
    string? EmployeeName,
    string? JobTitle,
    string? OrgUnitName,
    Guid? PlanId,
    RosterPlanStatus Status,
    int ObjectiveCount,
    decimal WeightTotal,
    // Objectives that have reported progress — meaningful once the plan is Approved.
    int UpdatedCount,
    bool HasProgress,
    decimal PlanProgress,
    RosterActivityKind ActivityKind,
    DateTime? ActivityAt,
    // CanReview: the strong "Review plan" action — a Submitted plan the caller may actually decide.
    bool CanReview,
    // CanView: the quiet inspection action — an existing plan the caller may open.
    bool CanView);

/// <summary>
/// The manager's people roster with lifecycle summary counts. Counts are computed from real membership
/// (never inferred health or roll-ups): people who need the caller's review, people still planning
/// (not started / draft / returned), approved people, and approved people not yet reporting progress.
/// </summary>
public sealed record TeamRosterDto(
    Guid CycleId,
    string CycleName,
    int TotalPeople,
    int NeedsReviewCount,
    int PlanningCount,
    int ApprovedCount,
    int NoProgressCount,
    IReadOnlyList<TeamRosterMemberDto> Members);

public sealed record AddPlanObjectiveRequest(
    string Title,
    string? Description,
    Guid? ParentObjectiveId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    MeasurementInput Measurement,
    decimal PlanWeight);

public sealed record UpdatePlanObjectiveRequest(
    string Title,
    string? Description,
    Guid? ParentObjectiveId,
    DateOnly? StartDate,
    DateOnly? EndDate,
    MeasurementInput Measurement,
    decimal PlanWeight);

public sealed record PlanWeightInput(Guid ObjectiveId, decimal Weight);

public sealed record SetPlanWeightsRequest(IReadOnlyList<PlanWeightInput> Weights);

public sealed record ReturnPlanRequest(string Feedback);

public sealed record ExceptionalApprovePlanRequest(string Reason);

// ----- Progress & contribution (Chunk D) -----

public sealed record EvidenceDto(
    Guid Id,
    EvidenceKind Kind,
    string? FileName,
    string? ContentType,
    long? SizeBytes,
    string? Url,
    string? ReferenceText,
    // Present only for a File the caller may open; null hides the action when authorization fails.
    string? DownloadPath);

public sealed record ProgressUpdateDto(
    Guid Id,
    ProgressEventKind Kind,
    decimal? Value,
    Guid? MilestoneId,
    string? MilestoneTitle,
    string? ContextNote,
    bool IsCorrection,
    PersonRefDto Author,
    DateTime RecordedAt,
    IReadOnlyList<EvidenceDto> Evidence,
    // The objective's derived progress immediately after this update, and its signed change from the
    // previous update (the first update's delta is measured from the objective's unstarted 0).
    decimal ResultingProgress,
    decimal DeltaProgress);

/// <summary>One page of an objective's progress history, newest first, with the cursor for the next older page.</summary>
public sealed record ProgressHistoryPageDto(IReadOnlyList<ProgressUpdateDto> Items, string? NextCursor);

public sealed record ProgressMilestoneDto(Guid Id, string Title, decimal Weight, bool IsCompleted);

/// <summary>The full progress surface for one objective — current state, measurement, and attributable history.</summary>
public sealed record ObjectiveProgressDto(
    Guid ObjectiveId,
    string Title,
    ObjectiveOwnershipScope OwnershipScope,
    MeasurementMethod Method,
    bool HasProgress,
    decimal DerivedProgress,
    decimal? CurrentPercentage,
    decimal? CurrentActual,
    decimal? Baseline,
    decimal? Target,
    string? Unit,
    ImprovementDirection? Direction,
    IReadOnlyList<ProgressMilestoneDto> Milestones,
    bool CanUpdate,
    IReadOnlyList<ProgressUpdateDto> History,
    // Cursor for the next older page of History; null when the first page already holds all of it.
    string? HistoryNextCursor);

/// <summary>Staged file descriptor returned by the evidence upload, folded into the progress submit.</summary>
public sealed record EvidenceDescriptorDto(string StorageKey, string FileName, string ContentType, long SizeBytes);

public sealed record EvidenceInput(
    EvidenceKind Kind,
    string? StorageKey,
    string? FileName,
    string? ContentType,
    long? SizeBytes,
    string? Url,
    string? Label,
    string? ReferenceText);

public sealed record SubmitProgressRequest(
    decimal? Percentage,
    decimal? NumericActual,
    Guid? MilestoneId,
    bool? MilestoneCompleted,
    string? ContextNote,
    bool IsCorrection,
    IReadOnlyList<EvidenceInput>? Evidence);

// Contribution Explorer

/// <summary>One node in the Contribution Explorer — reported progress is primary, coverage is quieter context.</summary>
public sealed record ContributionNodeDto(
    Guid Id,
    ObjectiveOwnershipScope OwnershipScope,
    string Title,
    string? OrgUnitName,
    Guid AccountablePersonId,
    string? AccountablePersonName,
    ObjectiveProgressSource ProgressSource,
    bool HasProgress,
    decimal ReportedProgress,
    // Coverage only applies to a calculated parent; null for direct objectives.
    decimal? Coverage,
    int ChildCount,
    int ContributorCount,
    // This node's contribution weight to a calculated parent, when configured.
    decimal? ContributionToParent);

public sealed record ContributionContributorDto(
    Guid ChildObjectiveId,
    string Title,
    decimal Weight,
    bool HasProgress,
    decimal ReportedProgress);

public sealed record ContributionOverviewDto(
    Guid CycleId,
    string CycleName,
    IReadOnlyList<ContributionNodeDto> Roots);

public sealed record ContributionDetailDto(
    ContributionNodeDto Node,
    string? Description,
    IReadOnlyList<ContributionNodeDto> Trail,
    IReadOnlyList<ContributionNodeDto> Children,
    // For a calculated node, the configured contributors with their reported progress and weight.
    IReadOnlyList<ContributionContributorDto> Contributors);
