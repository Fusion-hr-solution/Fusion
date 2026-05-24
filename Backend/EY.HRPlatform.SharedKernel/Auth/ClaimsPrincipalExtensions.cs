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

    public static IReadOnlyList<EffectivePermissionGrant> GetCorePermissions(this ClaimsPrincipal principal)
    {
        var grants = principal.FindAll(CustomClaimTypes.CorePermission)
            .Select(claim => CorePermissionClaimValue.TryDecode(claim.Value, out var grant) ? grant : null)
            .Where(grant => grant is not null)
            .Cast<EffectivePermissionGrant>()
            .GroupBy(grant => grant.PermissionKey, StringComparer.Ordinal)
            .Select(group => group.Aggregate((current, next) =>
                PermissionScopes.GetRank(next.Scope) > PermissionScopes.GetRank(current.Scope)
                    ? next
                    : current))
            .ToList();

        return grants;
    }

    public static string? GetCorePermissionScope(this ClaimsPrincipal principal, string permissionKey)
        => principal.GetCorePermissions()
            .FirstOrDefault(grant => string.Equals(grant.PermissionKey, permissionKey, StringComparison.Ordinal))
            ?.Scope;

    public static bool HasCorePermission(this ClaimsPrincipal principal, string permissionKey)
        => principal.GetCorePermissionScope(permissionKey) is not null;

    public static bool HasCorePermission(this ClaimsPrincipal principal, string permissionKey, string requiredScope)
    {
        var grantedScope = principal.GetCorePermissionScope(permissionKey);
        return grantedScope is not null
            && PermissionScopes.GetRank(grantedScope) >= PermissionScopes.GetRank(requiredScope);
    }

    public static bool HasAnyCorePermission(this ClaimsPrincipal principal, params string[] permissionKeys)
        => permissionKeys.Any(principal.HasCorePermission);
}
