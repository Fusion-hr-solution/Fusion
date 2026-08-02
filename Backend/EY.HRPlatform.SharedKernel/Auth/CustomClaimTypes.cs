namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Custom claim type constants used across the platform.
/// Centralizes claim keys to avoid magic strings.
/// </summary>
public static class CustomClaimTypes
{
    /// <summary>
    /// Customer tenant. Present only when the account has exactly one Active
    /// tenant membership; its absence means no customer-workspace authority.
    /// </summary>
    public const string TenantId = "tenant_id";

    /// <summary>Membership that authorizes the customer tenant context.</summary>
    public const string TenantMembershipId = "tenant_membership_id";

    /// <summary>One claim per module enabled for the customer tenant.</summary>
    public const string ModuleEntitlement = "module_entitlement";
    public const string EmployeeId = "employee_id";
    public const string FullName = "full_name";
    public const string Department = "department";
    public const string JobTitle = "job_title";
    public const string CorePermission = "core_permission";
}
