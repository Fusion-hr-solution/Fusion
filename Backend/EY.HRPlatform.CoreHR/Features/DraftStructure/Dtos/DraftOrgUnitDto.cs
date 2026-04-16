namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record DraftOrgUnitDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    Guid? ParentId,
    string? ParentName,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

public sealed record DraftOrgUnitTreeNodeDto(
    Guid Id,
    string Code,
    string Name,
    string Type,
    int Level,
    bool IsOrphaned,
    List<DraftOrgUnitTreeNodeDto> Children);