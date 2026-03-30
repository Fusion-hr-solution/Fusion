using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.CoreHR.Features.OrgUnits.Dtos;

/// <summary>
/// Request DTO for updating an org unit.
/// Code is immutable after creation.
/// </summary>
public sealed record UpdateOrgUnitRequest(
    [Required]
    [StringLength(200, MinimumLength = 1)]
    string Name,

    [Required]
    [StringLength(100, MinimumLength = 1)]
    string Type,

    Guid? ParentId);
