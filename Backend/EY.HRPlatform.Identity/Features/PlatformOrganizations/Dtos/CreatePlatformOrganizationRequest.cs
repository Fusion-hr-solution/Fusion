using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Features.PlatformOrganizations.Dtos;

public sealed class CreatePlatformOrganizationRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required]
    [EmailAddress]
    public string FirstAdminEmail { get; set; } = string.Empty;

    [StringLength(100)]
    public string? FirstAdminFirstName { get; set; }

    [StringLength(100)]
    public string? FirstAdminLastName { get; set; }

    [StringLength(100)]
    public string? PlanTier { get; set; }

    [StringLength(4000)]
    public string? InternalNotes { get; set; }
}
