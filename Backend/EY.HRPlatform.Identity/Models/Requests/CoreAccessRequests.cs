using System.ComponentModel.DataAnnotations;

namespace EY.HRPlatform.Identity.Models.Requests;

public sealed class AccessProfileGrantInputDto
{
    [Required]
    public string PermissionKey { get; set; } = string.Empty;

    [Required]
    public string Scope { get; set; } = string.Empty;
}

public sealed class CreateAccessProfileRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(280)]
    public string? Description { get; set; }

    public List<AccessProfileGrantInputDto> Grants { get; set; } = [];
}

public sealed class UpdateAccessProfileRequest
{
    [Required, MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(280)]
    public string? Description { get; set; }

    public List<AccessProfileGrantInputDto> Grants { get; set; } = [];
}

public sealed class SetUserAccessProfilesRequest
{
    public List<Guid> AccessProfileIds { get; set; } = [];
}
