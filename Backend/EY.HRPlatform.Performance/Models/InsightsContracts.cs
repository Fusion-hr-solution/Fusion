using EY.HRPlatform.Performance.Domain.Cycles;

namespace EY.HRPlatform.Performance.Models;

/// <summary>A unit the Insights filter offers: the population's units and their parents, with their depth.</summary>
public sealed record InsightsUnitOptionDto(Guid UnitId, string Name, int Depth);

public sealed record LevelCountDto(int Value, string Label, int Count);

/// <summary>
/// One unit's figures (or the total row): counts and shares only. Execution figures are present from Execution, review
/// figures once a round has them; ratings are final, after calibration.
/// </summary>
public sealed record InsightsRowDto(
    Guid? UnitId, string Name, int People,
    int PlansApproved,
    int? ApprovedPlans, int? UpdatedIn30Days, StatusMixDto? Status, int? Objectives, int? Aligned,
    int? Reviews, int? OnTime, int? Late, int? Released, int? Acknowledged, IReadOnlyList<LevelCountDto>? Levels, int? Raised, int? Lowered);

public sealed record InsightsManagerDto(Guid EmployeeId, string Name, string? UnitName, int People, int Late, int Released, int Acknowledged);

/// <summary>A company objective: who owns it, the objectives aligned under it, the units contributing, its own progress.</summary>
public sealed record InsightsDirectionDto(Guid ObjectiveId, string Title, string? Owner, int AlignedObjectives, int UnitsContributing,
    int Units, decimal Progress, bool HasProgress);

/// <summary>
/// Cycle › Insights for cycle administrators (performance-hr-insights): how the cycle is going across the organization,
/// by unit and by manager, filtered to a unit and its sub-units. Sections arrive with the phase. No averages, no export.
/// </summary>
public sealed record InsightsDto(
    Guid CycleId, string CycleName, CycleLifecycleState State, DateOnly AsOf, bool Final, int Participants,
    Guid? UnitId, string ScopeName, IReadOnlyList<InsightsUnitOptionDto> Units,
    bool ShowsExecution, bool ShowsReviews, Guid? RoundId, string? RoundName, DateOnly? ManagerDue, DateTime? ReleasedAt,
    int NeverApproved, int WithoutRecentUpdate,
    IReadOnlyList<InsightsRowDto> ByUnit, InsightsRowDto Total,
    IReadOnlyList<InsightsDirectionDto> Direction, int NotAligned,
    IReadOnlyList<InsightsManagerDto> ByManager);

/// <summary>One person behind a figure, with the facts that put them there and where the administrator opens them.</summary>
public sealed record InsightsPersonDto(
    Guid EmployeeId, string Name, string? JobTitle, string? UnitName, string? ManagerName,
    RosterPlanStatus? PlanState, DateTime? LastUpdateAt, DateOnly? ManagerDue, DateTime? ManagerSubmittedAt,
    DateTime? ReleasedAt, DateTime? AcknowledgedAt, int? Level, int? ManagerLevel, string? Href);

public sealed record InsightsPeoplePageDto(string Metric, int Total, int Page, int PageSize, IReadOnlyList<InsightsPersonDto> Items);
