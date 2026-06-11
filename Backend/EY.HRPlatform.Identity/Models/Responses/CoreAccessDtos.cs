namespace EY.HRPlatform.Identity.Models.Responses;

public sealed class CorePermissionCatalogItemDto
{
    public string PermissionKey { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string? HelperText { get; set; }
    public List<string> AllowedScopes { get; set; } = [];
}

public sealed class EffectivePermissionGrantDto
{
    public string PermissionKey { get; set; } = string.Empty;
    public string Scope { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Group { get; set; } = string.Empty;
    public string? HelperText { get; set; }
    public List<string> AllowedScopes { get; set; } = [];
}

public sealed class AccessProfileAssignmentSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public bool IsSystemProtected { get; set; }
}

public sealed class AccessProfileSummaryDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string Type { get; set; } = string.Empty;
    public bool IsSystemProtected { get; set; }
    public int AssignedUserCount { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? UpdatedAt { get; set; }
    public uint Version { get; set; }
    public List<EffectivePermissionGrantDto> Grants { get; set; } = [];
}

public sealed class UserAccessAssignmentDto
{
    public Guid UserId { get; set; }
    public Guid? EmployeeId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Department { get; set; }
    public string? JobTitle { get; set; }
    public bool IsActive { get; set; }
    public DateTime? LastLoginAt { get; set; }
    public List<AccessProfileAssignmentSummaryDto> AccessProfiles { get; set; } = [];
}

public sealed class CurrentUserAccessDto
{
    public Guid TenantId { get; set; }
    public List<AccessProfileAssignmentSummaryDto> AccessProfiles { get; set; } = [];
    public List<EffectivePermissionGrantDto> EffectivePermissions { get; set; } = [];
}
