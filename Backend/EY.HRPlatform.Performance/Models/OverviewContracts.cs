using System.Text.Json.Serialization;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Development;
using EY.HRPlatform.Performance.Domain.Progress;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.SharedKernel.Api;

namespace EY.HRPlatform.Performance.Models;

/// <summary>
/// Overview as one server projection (performance-overview): where the selected Cycle's year stands, then one row per
/// responsibility in a fixed order (the cycle, your team or the reviews you write, your own review and plan, input you
/// owe, development, conversations, organization direction). Facts only — counts, states, dates, at most six people —
/// never rosters, trees or averaged progress. The client composes the words; every row ends in a workspace or record.
/// </summary>
public sealed record OverviewDto(
    CycleSummaryDto? Cycle,
    CyclePhase? Phase,
    OverviewYearDto? Year,
    IReadOnlyList<OverviewRowDto> Rows,
    WorkspaceDestinationsDto Destinations);

// ── The year ──────────────────────────────────────────────────────────────────────────────────────────────────────

public enum YearPhaseState { Done = 0, Current = 1, Upcoming = 2 }

/// <summary>One phase sized by its dates. <paramref name="Estimated"/> when no review round dates it yet.</summary>
public sealed record YearPhaseDto(string Name, DateOnly Start, DateOnly End, YearPhaseState State, bool Estimated);

/// <summary>A date that concerns the viewer: `plans-due`, `self-due`, `peers-due`, `reviews-due`, `managers-due`, `cycle-end`, `cycle-start`.</summary>
public sealed record YearDateDto(string Kind, DateOnly Date, int? Count = null);

/// <summary>
/// The selected Cycle's year: its phases, today, the dates that concern the viewer and the next one. Days left count
/// to <paramref name="Next"/>; a closed cycle has no today marker and states when it closed.
/// </summary>
public sealed record OverviewYearDto(
    CycleLifecycleState State,
    DateOnly Start,
    DateOnly End,
    DateOnly Today,
    IReadOnlyList<YearPhaseDto> Phases,
    string? CurrentPhase,
    IReadOnlyList<YearDateDto> Dates,
    YearDateDto? Next,
    int? DaysLeft,
    DateTime? ClosedAt);

// ── Rows ──────────────────────────────────────────────────────────────────────────────────────────────────────────

[JsonPolymorphic(TypeDiscriminatorPropertyName = "kind")]
[JsonDerivedType(typeof(NextCycleRowDto), "nextCycle")]
[JsonDerivedType(typeof(CycleRowDto), "cycle")]
[JsonDerivedType(typeof(TeamRowDto), "team")]
[JsonDerivedType(typeof(ReviewsYouWriteRowDto), "reviewsYouWrite")]
[JsonDerivedType(typeof(OwnReviewRowDto), "ownReview")]
[JsonDerivedType(typeof(InputOwedRowDto), "inputOwed")]
[JsonDerivedType(typeof(OwnPlanRowDto), "ownPlan")]
[JsonDerivedType(typeof(DevelopmentRowDto), "development")]
[JsonDerivedType(typeof(ConversationsRowDto), "conversations")]
[JsonDerivedType(typeof(DirectionRowDto), "direction")]
[JsonDerivedType(typeof(NotParticipantRowDto), "notParticipant")]
[JsonDerivedType(typeof(NoCycleRowDto), "noCycle")]
public abstract record OverviewRowDto;

/// <summary>A person shown as a chip. <paramref name="State"/> is a key the client words; NeedsYou marks the ones waiting on the viewer.</summary>
public sealed record OverviewChipDto(Guid EmployeeId, string Name, string State, DateTime? Since, bool NeedsYou, string? Href);

/// <summary>Counts of objectives by the status their owners last set (D-05); never inferred.</summary>
public sealed record StatusMixDto(int OnTrack, int AtRisk, int OffTrack, int NoStatus);

public sealed record PlanStatesDto(int Approved, int Submitted, int Drafting, int NotStarted);

/// <summary>A unit's share for one question (plans approved, plans updated): <paramref name="Count"/> of <paramref name="Total"/>.</summary>
public sealed record UnitShareDto(Guid? UnitId, string Name, int Count, int Total, int Missing);

/// <summary>The next cycle for administrators: being set up (a Draft) or still to create.</summary>
public sealed record NextCycleRowDto(Guid? CycleId, string? Name, DateOnly? PlannedStart, CycleDetailDto? Setup) : OverviewRowDto;

public sealed record CyclePlanningFactsDto(PlanStatesDto Plans, IReadOnlyList<UnitShareDto> FurthestBehind);

public sealed record CycleExecutionFactsDto(int ApprovedPlans, int UpdatedIn30Days, int Objectives, StatusMixDto Status,
    int NeverApproved, IReadOnlyList<UnitShareDto> FurthestBehind);

public sealed record LateManagerDto(Guid EmployeeId, string Name, string? UnitName, int Late, int Submitted, int Total);

public sealed record CycleReviewFactsDto(
    Guid RoundId, string RoundName, int Subjects,
    int SelfSubmitted, int SelfTotal, DateOnly? SelfDue,
    int ManagerSubmitted, int ManagerTotal, int ManagerLate, DateOnly? ManagerDue,
    bool CalibrationEnabled, CalibrationSessionState? CalibrationState, int CalibrationDiscussed, int CalibrationSubjects,
    int ReadyToFinalize, IReadOnlyList<LateManagerDto> LateManagers, int OtherLateManagers, int OtherLate);

public sealed record CycleClosedFactsDto(int Released, int Acknowledged, int CalibrationChanged, int OpenGrowthGoals, DateTime? ReleasedAt);

/// <summary>The cycle for its administrators, with the facts of its phase. Unit and status facts link to Insights.</summary>
public sealed record CycleRowDto(
    Guid CycleId, string CycleName, CycleLifecycleState State, int Participants, int ApprovedPlans,
    CycleDetailDto? Setup,
    CyclePlanningFactsDto? Planning,
    CycleExecutionFactsDto? Execution,
    CycleReviewFactsDto? Review,
    CycleClosedFactsDto? Closed) : OverviewRowDto;

public sealed record FlaggedObjectiveDto(Guid ObjectiveId, Guid EmployeeId, string PersonName, string Title, ObjectiveStatus Status,
    string? Reason, DateTime? Since, decimal Progress, string Href);

public sealed record TeamResultsFactsDto(int Released, int Acknowledged, IReadOnlyList<string> NotAcknowledged, int CalibrationChanged,
    int WithOpenGrowthGoals);

/// <summary>
/// The people the viewer is the recorded reviewer of: plan states, the first decision waiting (its exact place), up to
/// six people, flagged objectives with the owner's reason, update recency, open requests, and after release their results.
/// </summary>
public sealed record TeamRowDto(
    int People,
    int Objectives,
    PlanStatesDto Plans,
    int AwaitingDecision,
    string? FirstAwaitingName,
    string? FirstAwaitingHref,
    IReadOnlyList<OverviewChipDto> Chips,
    IReadOnlyList<FlaggedObjectiveDto> Flagged,
    int FlaggedTotal,
    int ApprovedPlans,
    int UpdatedIn30Days,
    IReadOnlyList<string> WithoutRecentUpdate,
    int WithoutRecentUpdateTotal,
    int OpenRequests,
    DateOnly CycleEnd,
    TeamResultsFactsDto? Results) : OverviewRowDto;

/// <summary>The reviews the viewer writes in the running round, with up to six people and the first ready one.</summary>
public sealed record ReviewsYouWriteRowDto(
    Guid RoundId, string RoundName, DateOnly? DueDate, int Total, int Ready, int Submitted,
    int PeerListsToApprove, DateOnly? PeerListsDue, string? FirstReadyName, string? FirstReadyHref,
    IReadOnlyList<OverviewChipDto> Chips, bool InCalibration) : OverviewRowDto;

public sealed record OwnResultDto(int Level, string Label, DateTime ReleasedAt, DateTime? AcknowledgedAt);

/// <summary>The viewer's own review: an open one with its path, or a released result.</summary>
public sealed record OwnReviewRowDto(
    Guid ReviewId, string RoundName, PerformanceReviewState State, string ReviewerName, DateOnly? DueDate,
    IReadOnlyList<FusionWorkStepDto>? Steps, int PeersAnswered, int PeersAsked, DateTime? DraftSavedAt, DateTime? SelfSubmittedAt,
    OwnResultDto? Result, string Href) : OverviewRowDto;

public sealed record PeerAskDto(Guid RequestId, string SubjectName, int Questions, DateOnly? DueDate, string Href);

/// <summary>Peer input the viewer owes in a running round.</summary>
public sealed record InputOwedRowDto(IReadOnlyList<PeerAskDto> Requests) : OverviewRowDto;

/// <summary>Where the viewer's own plan stands: planning facts before approval, execution facts after.</summary>
public sealed record OwnPlanRowDto(
    RosterPlanStatus Standing,
    int Objectives,
    int AlignedObjectives,
    decimal WeightTotal,
    int? MinObjectives,
    int? MaxObjectives,
    string? ReviewerName,
    DateTime? SubmittedAt,
    string? ReturnFeedback,
    string? ReturnedBy,
    DateOnly PlanningDeadline,
    bool PlanningOpen,
    decimal? Progress,
    StatusMixDto? Status,
    DateTime? LastUpdateAt,
    int StaleObjectives,
    int? StalestDays,
    int OpenRequests,
    string? FirstRequestBy,
    string? FirstRequestObjective,
    string? FirstRequestHref,
    string Href) : OverviewRowDto;

public sealed record DevelopmentGoalFactDto(Guid Id, string Title, DevelopmentGoalStatus Status, DateOnly? TargetDate);

/// <summary>After the viewer's result is released: their development goals, open ones carrying into the next cycle.</summary>
public sealed record DevelopmentRowDto(int Total, int Open, IReadOnlyList<DevelopmentGoalFactDto> Goals, string Href) : OverviewRowDto;

public sealed record NextMeetingDto(Guid SeriesId, string With, DateTime At, int Agenda, int OpenActions, string Href);

/// <summary>One thing owed in conversations: a feedback request to answer or an overdue 1:1 action.</summary>
public sealed record OwedConversationDto(string Kind, string Title, string? Context, DateOnly? Due, int Count, string Href);

/// <summary>The viewer's next 1:1s (at most two) and one owed item. Not tied to a cycle.</summary>
public sealed record ConversationsRowDto(IReadOnlyList<NextMeetingDto> Meetings, OwedConversationDto? Owed) : OverviewRowDto;

/// <summary>The published company objectives (at most three) with their progress; final once the cycle is closed.</summary>
public sealed record DirectionRowDto(int Count, IReadOnlyList<GoalNodeDto> Objectives, bool Final) : OverviewRowDto;

/// <summary>The viewer isn't in the selected cycle's population: when they joined and when it was set.</summary>
public sealed record NotParticipantRowDto(string CycleName, DateOnly? Joined, DateTime? PopulationSetAt) : OverviewRowDto;

/// <summary>Nothing has run yet: administrators may create a cycle.</summary>
public sealed record NoCycleRowDto(bool CanCreate, NoCycleReadinessDto? Readiness = null) : OverviewRowDto;

/// <summary>
/// What a first cycle would start from, for administrators (board 16): the people Core HR holds and who has a manager
/// (someone without one would be left out), the units they sit in, and the rating scale and competencies a review would
/// use. <paramref name="WorkforceAvailable"/> is false when Core HR couldn't be read; the Performance facts still show.
/// </summary>
public sealed record NoCycleReadinessDto(bool WorkforceAvailable, int People, int WithManager, IReadOnlyList<string> WithoutManager,
    int Units, int RatingLevels, int Competencies);
