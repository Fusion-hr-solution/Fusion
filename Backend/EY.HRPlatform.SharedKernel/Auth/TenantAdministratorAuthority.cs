namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// The canonical Tenant Administrator authority definition.
/// <para>
/// This is the single predefined, tenant-scoped, tenant-non-editable administration
/// role. It is the <em>definition</em> of what the authority means; the authority a
/// person actually holds is the tenant administrator assignment record, never a
/// role name and never a permission projection.
/// </para>
/// </summary>
public static class TenantAdministratorAuthority
{
    /// <summary>Durable internal key. Never rendered to a user.</summary>
    public const string InternalKey = "tenant-administrator";

    /// <summary>Business-facing name. Rendered directly.</summary>
    public const string DisplayName = "Tenant Administrator";

    public const string Description =
        "Broad administration within the tenant across its enabled Fusion modules. "
        + "Grants no Platform access and no permission to change tenant entitlements.";

    /// <summary>
    /// Composes the Tenant Administrator grant set for a tenant.
    /// <para>
    /// Every contributed permission whose allowed scopes include <c>Tenant</c> is
    /// granted at <c>Tenant</c>. Module-scoped permissions are granted at
    /// <c>Module</c> only when the tenant holds that module's entitlement, which
    /// the caller expresses through <paramref name="enabledModuleKeys"/>.
    /// Self-service permissions are granted at <c>Self</c>.
    /// </para>
    /// <para>
    /// Permissions whose widest allowed scope is <c>DirectReports</c> or
    /// <c>OrgUnit</c> are deliberately not widened: tenant-wide administration is
    /// not workforce impersonation.
    /// </para>
    /// </summary>
    public static IReadOnlyList<EffectivePermissionGrant> BuildGrants(IEnumerable<string> enabledModuleKeys)
    {
        var enabled = new HashSet<string>(enabledModuleKeys, StringComparer.OrdinalIgnoreCase);
        var grants = new List<EffectivePermissionGrant>();
        var seen = new HashSet<string>(StringComparer.Ordinal);

        foreach (var contribution in ModulePermissionRegistry.All)
        {
            if (!enabled.Contains(contribution.ModuleKey))
            {
                continue;
            }

            foreach (var definition in contribution.Definitions)
            {
                var scope = WidestAdministrativeScope(definition);
                if (scope is null || !seen.Add(definition.Key))
                {
                    continue;
                }

                grants.Add(new EffectivePermissionGrant(definition.Key, scope));
            }
        }

        return grants;
    }

    private static string? WidestAdministrativeScope(CorePermissionDefinition definition)
    {
        if (definition.AllowedScopes.Contains(PermissionScopes.Tenant, StringComparer.Ordinal))
        {
            return PermissionScopes.Tenant;
        }

        if (definition.AllowedScopes.Contains(PermissionScopes.Module, StringComparer.Ordinal))
        {
            return PermissionScopes.Module;
        }

        if (definition.AllowedScopes.Contains(PermissionScopes.Self, StringComparer.Ordinal))
        {
            return PermissionScopes.Self;
        }

        return null;
    }
}
