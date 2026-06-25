namespace EY.HRPlatform.Performance.Features.Milestones.Dtos;

public sealed record ObjectiveProgressDto(
    decimal EffectivePercent,
    string Mode,
    int CompletedMilestones,
    int TotalMilestones,
    IReadOnlyList<MilestoneDetailDto> Milestones);

public sealed record MilestoneDetailDto(
    Guid Id,
    string Title,
    DateTime DueDate,
    bool IsCompleted,
    DateTime? CompletedAt);

public sealed record AddMilestoneRequest(string Title, DateTime DueDate);

public sealed record UpdateObjectiveProgressRequest(decimal Percent, string? Comment);

public sealed record CorrectObjectiveProgressRequest(decimal Percent, string Reason);
