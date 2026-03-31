using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;

/// <summary>
/// Request DTO for creating an org unit.
/// </summary>
public sealed record CreateOrgUnitRequest(
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
