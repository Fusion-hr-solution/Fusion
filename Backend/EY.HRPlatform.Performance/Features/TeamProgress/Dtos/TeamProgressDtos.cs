using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.Progress.Dtos;

namespace EY.HRPlatform.Performance.Features.TeamProgress.Dtos;

public sealed record TeamProgressCampaignDto(
    Guid Id,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? LaunchedAt,
    DateTime? PlanningLockedAt,
    int ParticipantCount,
    int NeedsAttentionCount);

/// <summary>One assigned participant summarized for the attention-first team overview.</summary>
public sealed record TeamProgressParticipantDto(
    Guid EmployeeId,
    string EmployeeName,
    int WeightedProgressPercent,
    int ObjectiveCount,
    int CompletedObjectiveCount,
    int StaleObjectiveCount,
    bool HasRecentRegression,
    int NotStartedObjectiveCount,
    bool NeedsAttention,
    DateTime? LastActivityAt,
    IReadOnlyList<ObjectiveProgressStateDto> Objectives);

public sealed record TeamProgressWorkspaceDto(
    Guid CycleId,
    string Slug,
    string Name,
    int? ReferenceYear,
    DateTime? LaunchedAt,
    DateTime? PlanningLockedAt,
    int StaleAfterDays,
    IReadOnlyList<TeamProgressParticipantDto> Participants);

/// <summary>Read-only drill-in: one participant's locked objectives with full append-only history.</summary>
public sealed record TeamProgressObjectiveDetailDto(
    EmployeeObjectiveDto Objective,
    ObjectiveProgressStateDto State,
    IReadOnlyList<ObjectiveProgressUpdateDto> History);

public sealed record TeamProgressParticipantDetailDto(
    Guid CycleId,
    string Slug,
    string Name,
    Guid EmployeeId,
    string EmployeeName,
    PlanProgressDto Progress,
    IReadOnlyList<TeamProgressObjectiveDetailDto> Objectives);
