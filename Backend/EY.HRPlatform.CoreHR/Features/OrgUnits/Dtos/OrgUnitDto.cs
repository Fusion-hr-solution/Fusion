namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;

/// <summary>
/// DTO for OrgUnit data returned by queries and commands.
/// </summary>
public sealed record OrgUnitDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    Guid? ParentId,
    string? ParentName,
    bool IsActive,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

/// <summary>
/// Lightweight DTO for parent org unit info.
/// </summary>
public sealed record ParentOrgUnitDto(
    Guid Id,
    string Code,
    string Name);
