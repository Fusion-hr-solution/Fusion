using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class UpdatePlatformOrganizationRequest
{
    [StringLength(100, MinimumLength = 2)]
    public string? Name { get; set; }

    [StringLength(4000)]
    public string? InternalNotes { get; set; }
}
