namespace EY.HRPlatform.Identity.Models.Responses;

public class AuthResponse
{
    public Guid UserId { get; set; }

    /// <summary>
    /// Customer tenant, present only when the account has exactly one Active
    /// membership. Null for a Platform Administrator, and null when membership
    /// cardinality is corrupted, so the client cannot infer a workspace that the
    /// token does not authorize.
    /// </summary>
    public Guid? TenantId { get; set; }

    /// <summary>Membership that authorizes the customer tenant context.</summary>
    public Guid? TenantMembershipId { get; set; }

    /// <summary>Modules enabled for the customer tenant. Empty without one.</summary>
    public List<string> ModuleEntitlements { get; set; } = [];
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public Guid? EmployeeId { get; set; }
    public List<AccessProfileAssignmentSummaryDto> AccessProfiles { get; set; } = [];
    public List<EffectivePermissionGrantDto> EffectivePermissions { get; set; } = [];
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime AccessTokenExpiration { get; set; }
}
