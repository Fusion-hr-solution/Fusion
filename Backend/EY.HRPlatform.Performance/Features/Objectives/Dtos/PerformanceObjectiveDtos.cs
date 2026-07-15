namespace EY.HRPlatform.Performance.Features.Objectives.Dtos;

public sealed record PerformanceObjectiveDto(
    Guid Id,
    Guid CycleId,
    string Level,
    Guid OwnerEmployeeId,
    Guid? ParentObjectiveId,
    string Title,
    string? Description,
    string SuccessMeasure,
    string Target,
    DateTime DueDate,
    decimal? Weight,
    string Status,
    DateTime? SubmittedAt,
    DateTime? ApprovedAt,
    uint Version);
