using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Features.DraftStructure.Dtos;

public sealed record UpdateDraftOrgUnitRequest(
    [Required]
    [StringLength(50, MinimumLength = 1)]
    string Code,

    [Required]
    [StringLength(200, MinimumLength = 1)]
    string Name,

    [Required]
    [StringLength(100, MinimumLength = 1)]
    string Type,

    Guid? ParentId);