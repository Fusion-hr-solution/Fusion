namespace EY.HRPlatform.Performance.Features.Strategic.Dtos;

/// <summary>
/// Read projection of a strategic objective (includes Superseded versions for history).
/// </summary>
public sealed record StrategicObjectiveDto(
    Guid Id,
    Guid TenantId,
    Guid PeriodId,
    string OrgScope,
    string Title,
    string? Description,
    string Status,
    int VersionNumber,
    Guid? SupersededById,
    DateTime? PublishedAt,
    uint Version);

/// <summary>HTTP request body for creating a draft strategic objective.</summary>
public sealed record CreateStrategicObjectiveRequest(
    Guid PeriodId,
    string OrgScope,
    string Title,
    string? Description);
