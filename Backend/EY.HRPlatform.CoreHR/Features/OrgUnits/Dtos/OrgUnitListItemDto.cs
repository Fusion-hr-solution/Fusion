namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;

/// <summary>
/// Lightweight DTO for org unit list views.
/// </summary>
public sealed record OrgUnitListItemDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    Guid? ParentId,
    string? ParentName,
    bool IsActive);
