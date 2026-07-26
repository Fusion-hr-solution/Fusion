using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;

namespace EY.HRPlatform.Performance.Features.Progress.Dtos;

public sealed record ObjectiveProgressAttachmentDto(
    Guid Id,
    string FileName,
    string ContentType,
    long SizeBytes);

public sealed record ObjectiveProgressUpdateDto(
    Guid Id,
    Guid ObjectiveId,
    int ProgressPercent,
    int? PreviousPercent,
    string? ActualValue,
    string? Comment,
    bool IsRegression,
    string? RegressionReason,
    string ActorName,
    DateTime RecordedAt,
    IReadOnlyList<ObjectiveProgressAttachmentDto> Evidence);

/// <summary>Derived progress state for one locked objective — computed from history, never stored.</summary>
public sealed record ObjectiveProgressStateDto(
    Guid ObjectiveId,
    int CurrentPercent,
    string State,
    bool IsStale,
    DateTime? LastUpdateAt,
    int UpdateCount,
    string? LastActualValue);

/// <summary>Derived plan-level progress over the locked baseline weights.</summary>
public sealed record PlanProgressDto(
    int WeightedProgressPercent,
    int ObjectiveCount,
    int CompletedObjectiveCount,
    int StaleObjectiveCount,
    int StaleAfterDays,
    IReadOnlyList<ObjectiveProgressStateDto> Objectives);

public sealed record RecordObjectiveProgressRequest(
    int ProgressPercent,
    string? ActualValue,
    string? Comment,
    bool RegressionConfirmed,
    string? RegressionReason,
    IReadOnlyList<Guid>? AttachmentIds);

public sealed record RecordObjectiveProgressResponseDto(
    bool Recorded,
    string Outcome,
    bool Retryable,
    ObjectiveProgressUpdateDto? Update,
    PlanProgressDto? Progress,
    uint PlanVersion,
    IReadOnlyList<ObjectivePlanBlockingReasonDto> BlockingReasons);

public static class RecordObjectiveProgressOutcomes
{
    public const string Recorded = "recorded";
    public const string Blocked = "blocked";
    public const string Conflict = "conflict";
}
