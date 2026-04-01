using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Features.Tenants.Dtos;

public record CreateTenantRequest(
    [Required]
    [StringLength(100, MinimumLength = 2, ErrorMessage = "Name must be 2-100 characters.")]
    string Name
);
