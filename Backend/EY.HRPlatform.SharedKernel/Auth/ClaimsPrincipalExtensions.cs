using System.Security.Claims;

namespace EY.HRPlatform.SharedKernel.Auth;

public static class ClaimsPrincipalExtensions
{
    public static Guid GetUserId(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(ClaimTypes.NameIdentifier)
            ?? throw new InvalidOperationException("User ID claim not found.");
        return Guid.Parse(claim.Value);
    }

    public static string GetEmail(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(ClaimTypes.Email)?.Value
            ?? throw new InvalidOperationException("Email claim not found.");
    }

    public static bool IsInRole(this ClaimsPrincipal principal, string role)
    {
        return principal.IsInRole(role);
    }

    public static string GetFullName(this ClaimsPrincipal principal)
    {
        return principal.FindFirst(CustomClaimTypes.FullName)?.Value ?? "Unknown";
    }

    /// <summary>
    /// Extracts the tenant ID from the "tenant_id" claim if present.
    /// </summary>
    public static Guid? GetTenantId(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(CustomClaimTypes.TenantId);
        if (claim is null)
            return null;

        return Guid.TryParse(claim.Value, out var tenantId) && tenantId != Guid.Empty
            ? tenantId
            : null;
    }

    /// <summary>
    /// Extracts the linked employee ID from the "employee_id" claim if present.
    /// </summary>
    public static Guid? GetEmployeeId(this ClaimsPrincipal principal)
    {
        var claim = principal.FindFirst(CustomClaimTypes.EmployeeId);
        if (claim is null)
            return null;

        return Guid.TryParse(claim.Value, out var employeeId) && employeeId != Guid.Empty
            ? employeeId
            : null;
    }
}
