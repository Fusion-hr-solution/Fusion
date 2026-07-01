namespace EY.HRPlatform.Identity.Models.Responses;

public sealed record AccessAuditEventDto(
    Guid Id,
    DateTime OccurredAt,
    string ActorName,
    string ActorRole,
    string Action,
    string ResourceType,
    string? ResourceId,
    string Summary,
    string? BeforeJson,
    string? AfterJson,
    string? CorrelationId);
