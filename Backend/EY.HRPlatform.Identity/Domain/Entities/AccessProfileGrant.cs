using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

public class AccessProfileGrant : ITenantEntity
{
    private AccessProfileGrant() { }

    public Guid TenantId { get; private set; }
    public Guid AccessProfileId { get; private set; }
    public string PermissionKey { get; private set; } = string.Empty;
    public string Scope { get; private set; } = PermissionScopes.None;

    public AccessProfile? AccessProfile { get; private set; }

    public static AccessProfileGrant Create(
        Guid tenantId,
        Guid accessProfileId,
        string permissionKey,
        string scope)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));

        if (accessProfileId == Guid.Empty)
            throw new ArgumentException("AccessProfileId is required.", nameof(accessProfileId));

        var normalizedGrant = PermissionCatalog.NormalizeGrant(permissionKey, scope)
            ?? throw new ArgumentException(
                $"Invalid permission grant '{permissionKey}' / '{scope}'.",
                nameof(permissionKey));

        return new AccessProfileGrant
        {
            TenantId = tenantId,
            AccessProfileId = accessProfileId,
            PermissionKey = normalizedGrant.PermissionKey,
            Scope = normalizedGrant.Scope,
        };
    }
}
