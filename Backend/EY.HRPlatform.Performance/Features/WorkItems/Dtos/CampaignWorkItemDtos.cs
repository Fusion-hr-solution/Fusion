namespace EY.HRPlatform.Performance.Features.WorkItems.Dtos;

public sealed record CampaignWorkItemDto(
    Guid Id,
    Guid CycleId,
    Guid SubjectEmployeeId,
    Guid AssigneeEmployeeId,
    string Type,
    string Status,
    DateTime DueAt,
    DateTime? SubmittedAt,
    DateTime? CompletedAt,
    uint Version);
