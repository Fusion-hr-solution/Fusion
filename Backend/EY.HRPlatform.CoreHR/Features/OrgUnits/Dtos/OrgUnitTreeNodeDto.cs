namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;

/// <summary>
/// DTO for org unit tree node with computed hierarchy info.
/// </summary>
public sealed record OrgUnitTreeNodeDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    int Level,
    bool IsOrphaned,
    List<OrgUnitTreeNodeDto> Children);
