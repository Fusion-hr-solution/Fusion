using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record DraftOrgUnitDto(
    Guid Id,
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string OrgUnitKindLabel,
    string? Location,
    string? Description,
    Guid? ParentId,
    string? ParentReferenceKey,
    string? ParentDisplayName,
    Dictionary<string, object?> Attributes,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    uint Version);

public sealed record DraftOrgUnitTreeNodeDto(
    Guid Id,
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string OrgUnitKindLabel,
    string? Location,
    int Level,
    bool IsOrphaned,
    List<DraftOrgUnitTreeNodeDto> Children);