using EY.HRPlatform.CoreHR.Features.TenantSettings.Dtos;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record DraftOrgUnitDto(
    Guid Id,
    string ReferenceKey,
    string DisplayName,
    string OrgUnitKindKey,
    string OrgUnitKindLabel,
    string? BusinessCode,
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
    string? BusinessCode,
    int Level,
    bool IsOrphaned,
    List<DraftOrgUnitTreeNodeDto> Children);