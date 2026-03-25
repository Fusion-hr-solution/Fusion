namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Custom claim type constants for the HR Platform.
/// For standard claims, use System.Security.Claims.ClaimTypes.
/// </summary>
public static class CustomClaimTypes
{
    /// <summary>
    /// The tenant identifier claim. Used for multi-tenant data isolation.
    /// </summary>
    public const string TenantId = "tenant_id";

    /// <summary>
    /// The user's full name (first + last).
    /// </summary>
    public const string FullName = "full_name";

    /// <summary>
    /// The user's department.
    /// </summary>
    public const string Department = "department";

    /// <summary>
    /// The user's job title.
    /// </summary>
    public const string JobTitle = "job_title";
}
