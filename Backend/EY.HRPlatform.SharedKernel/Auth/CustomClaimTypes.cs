namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// Custom claim type constants used across the platform.
/// Centralizes claim keys to avoid magic strings.
/// </summary>
public static class CustomClaimTypes
{
    public const string TenantId = "tenant_id";
    public const string EmployeeId = "employee_id";
    public const string FullName = "full_name";
    public const string Department = "department";
    public const string JobTitle = "job_title";
    public const string CorePermission = "core_permission";
}
