namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Platform-wide role constants. Used for authorization across all modules.
/// </summary>
public static class PlatformRole
{
    /// <summary>
    /// Cross-tenant platform administrator (EY staff).
    /// Can manage tenants and switch context via X-Tenant-Id header.
    /// </summary>
    public const string PlatformAdmin = "PlatformAdmin";
    
    /// <summary>
    /// Tenant-scoped HR administrator.
    /// Can manage employees, org structure within their tenant.
    /// </summary>
    public const string HRAdmin = "HRAdmin";
    
    /// <summary>
    /// Regular employee with self-service access.
    /// </summary>
    public const string Employee = "Employee";
    
    /// <summary>
    /// Manager with team view and limited HR functions.
    /// </summary>
    public const string Manager = "Manager";

    public static readonly string[] All = [PlatformAdmin, HRAdmin, Employee, Manager];
}
