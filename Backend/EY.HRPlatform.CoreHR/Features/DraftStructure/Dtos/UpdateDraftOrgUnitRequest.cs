using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record UpdateDraftOrgUnitRequest(
    [Required]
    [StringLength(150, MinimumLength = 1)]
    string ReferenceKey,

    [Required]
    [StringLength(200, MinimumLength = 1)]
    string DisplayName,

    [Required]
    [StringLength(100, MinimumLength = 1)]
    string OrgUnitKindKey,

    [StringLength(100)]
    string? BusinessCode,

    [StringLength(500)]
    string? Description,

    Guid? ParentId,

    Dictionary<string, object?>? Attributes = null);