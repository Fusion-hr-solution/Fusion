using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Models;

/// <summary>
/// Overview as one server projection (performance-overview, design §13): the selected Cycle, the
/// sections that apply to the caller's capabilities and responsibilities in it, and where each one
/// resumes. Facts only — counts, states, dates — never rosters, trees or averaged progress.
/// </summary>
public sealed record OverviewDto(
    CycleSummaryDto? Cycle,
    CyclePhase? Phase,
    IReadOnlyList<OverviewSectionDto> Sections,
    WorkspaceDestinationsDto Destinations);

/// <summary>The workspace or record a section resumes in. The client turns it into a route for the Cycle.</summary>
public enum OverviewWorkspace
{
    MyPlan = 0,
    Team = 1,
    TeamNeedsReview = 2,
    CycleAdmin = 3,
    CycleSetup = 4,
    CycleCreate = 5,
    OrganizationDirection = 6,
    Plan = 7,
    Objective = 8,
    Reviews = 9,
    ReviewRound = 10,
    Calibration = 11,
}

public sealed record OverviewDestinationDto(OverviewWorkspace Workspace, Guid? CycleId, Guid? PlanId = null,
    Guid? ObjectiveId = null, Guid? ReviewRoundId = null);

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(CycleStatusSectionDto), "cycleStatus")]
[JsonDerivedType(typeof(SetupReadinessSectionDto), "setupReadiness")]
[JsonDerivedType(typeof(MyPlanSectionDto), "myPlan")]
[JsonDerivedType(typeof(TeamPlanningSectionDto), "teamPlanning")]
[JsonDerivedType(typeof(TeamExecutionSectionDto), "teamExecution")]
[JsonDerivedType(typeof(TeamDirectionSectionDto), "teamDirection")]
[JsonDerivedType(typeof(CycleOperationSectionDto), "cycleOperation")]
[JsonDerivedType(typeof(DirectionSectionDto), "direction")]
[JsonDerivedType(typeof(ClosedCycleSectionDto), "closedCycle")]
[JsonDerivedType(typeof(NoCycleSectionDto), "noCycle")]
[JsonDerivedType(typeof(MyReviewSectionDto), "myReview")]
[JsonDerivedType(typeof(TeamReviewsSectionDto), "teamReviews")]
[JsonDerivedType(typeof(ReviewOperationSectionDto), "reviewOperation")]
[JsonDerivedType(typeof(CalibrationSectionDto), "calibration")]
[JsonDerivedType(typeof(MyRequestsSectionDto), "myRequests")]
public abstract record OverviewSectionDto;

/// <summary>For someone with no section of their own in a running Cycle: its state, and nothing invented.</summary>
public sealed record CycleStatusSectionDto(CycleSummaryDto Cycle, CyclePhase? Phase) : OverviewSectionDto;

/// <summary>A Cycle in setup: its launch readiness, and the next setup step (administrators only).</summary>
public sealed record SetupReadinessSectionDto(CycleDetailDto Detail, OverviewDestinationDto Next) : OverviewSectionDto;

/// <summary>Execution facts of one's own Approved plan; absent before approval, so no 0% is ever shown.</summary>
public sealed record PlanExecutionFactsDto(
    decimal PlanProgress,
    int ObjectiveCount,
    int ReportingCount,
    int OverdueObjectiveCount,
    int WithoutRecentUpdateCount);

/// <summary>Where the caller's own plan stands and the next personal action.</summary>
public sealed record MyPlanSectionDto(
    RosterPlanStatus Standing,
    int ObjectiveCount,
    decimal WeightTotal,
    string? ReviewerName,
    DateTime? SubmittedAt,
    string? ReturnFeedback,
    string? ReturnedBy,
    DateOnly PlanningDeadline,
    bool PlanningOpen,
    PlanExecutionFactsDto? Execution,
    OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>The plan states of the people the caller is responsible for — counts, never the roster.</summary>
public sealed record TeamPlanningSectionDto(
    int People,
    int AwaitingDecision,
    int NotStarted,
    int Draft,
    int Returned,
    int Submitted,
    int Approved,
    OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>Execution facts across the caller's responsibility, once any plan is Approved.</summary>
public sealed record TeamExecutionSectionDto(
    int Approved,
    int ApprovedReporting,
    int PeopleWithOverdue,
    int PeopleWithoutRecentUpdate,
    OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>The team objectives the caller is accountable for (at most three), each opening in its record.</summary>
public sealed record TeamDirectionSectionDto(
    string? OrgUnitName,
    int Total,
    IReadOnlyList<GoalNodeDto> Objectives,
    OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>Administration's process state: planning distribution and execution counts, milestones, next action.</summary>
public sealed record CycleOperationSectionDto(
    CyclePlanSummaryDto Summary,
    IReadOnlyList<MilestoneStateDto> Milestones,
    OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>A small organization-direction signal: the published company objectives (at most three).</summary>
public sealed record DirectionSectionDto(
    int PublishedCount,
    IReadOnlyList<GoalNodeDto> Objectives,
    OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>Continuity after a Cycle closes, read from its activation snapshot and closure facts.</summary>
public sealed record ClosedCycleSectionDto(
    CycleSummaryDto Cycle,
    int ParticipantCount,
    int ApprovedCount,
    int ExceptionCount,
    int FinalizedReviewCount,
    decimal? MyPlanProgress,
    OverviewDestinationDto View,
    OverviewDestinationDto? Next) : OverviewSectionDto
{
    public OverviewDestinationDto? Reviews { get; init; }
}

/// <summary>Nothing has run yet: administrators may create a Cycle; everyone else is told plainly.</summary>
public sealed record NoCycleSectionDto(OverviewDestinationDto? Create) : OverviewSectionDto;

public sealed record MyReviewSectionDto(Guid? OpenReviewId, PerformanceReviewState? OpenState, DateOnly? DueDate,
    Guid? ResultReviewId, int FinalizedReviewCount, OverviewDestinationDto Destination) : OverviewSectionDto;
/// <summary>The reviewer's assessments in this Cycle: how many wait on them, and how many of all are submitted.</summary>
public sealed record TeamReviewsSectionDto(int AssessmentsReady, OverviewDestinationDto Destination,
    int AssessmentsSubmitted = 0, int AssessmentsTotal = 0) : OverviewSectionDto;
/// <summary>The Active round's stages and assessment completion. No ratings: those stay in round operations.</summary>
public sealed record ReviewOperationSectionDto(Guid ReviewRoundId, string ReviewRoundName, ReviewRoundState State,
    IReadOnlyList<ReviewStageCountOverviewDto> StageCounts, int ReadyToFinalize, OverviewDestinationDto Destination,
    Features.Reviews.ReviewCompletionDto? SelfAssessments = null, Features.Reviews.ReviewCompletionDto? ManagerAssessments = null) : OverviewSectionDto;
public sealed record ReviewStageCountOverviewDto(PerformanceReviewState State, int Count);
/// <summary>Calibration work for the caller's facilitator seat or a session they may open.</summary>
public sealed record CalibrationSectionDto(int Subjects, int Discussed, int Remaining, int Outstanding,
    CalibrationSessionState? SessionState, OverviewDestinationDto Destination) : OverviewSectionDto;

/// <summary>Open update requests on the caller's own plan, each resuming in the objective or the plan.</summary>
public sealed record MyRequestsSectionDto(IReadOnlyList<MyUpdateRequestDto> Requests) : OverviewSectionDto;
public sealed record MyUpdateRequestDto(Guid RequestId, string RequestedByName, DateTime RequestedAt, string? Note,
    string? ObjectiveTitle, OverviewDestinationDto Destination);
