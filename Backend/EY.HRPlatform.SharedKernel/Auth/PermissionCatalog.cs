namespace EY.HRPlatform.SharedKernel.Auth;

/// <summary>
/// The platform-wide resolver over every module's contributed permission slice.
/// <para>
/// Each module owns its own permission definitions and contributes them through
/// <see cref="ModulePermissionRegistry"/>. This resolver composes the Core slice
/// (<see cref="CorePermissionCatalog"/>) with every module contribution into one
/// lookup used for grant normalization, claim validation, and Identity access-profile
/// composition — so no module needs to edit another module's catalogue and there is
/// no second permission system.
/// </para>
/// <para>
/// <see cref="CorePermissionCatalog"/> remains the Core slice and is not the owner of
/// other modules' permissions. Two modules declaring the same key with different
/// definitions is a wiring bug and fails explicitly at first use rather than letting
/// one silently shadow the other.
/// </para>
/// </summary>
public static class PermissionCatalog
{
    // Lazy so composition runs at first runtime use — after CorePermissionCatalog and
    // ModulePermissionRegistry have finished their own static initialization, avoiding
    // any static-init ordering hazard between them.
    private static readonly Lazy<IReadOnlyDictionary<string, CorePermissionDefinition>> ByKeyLazy =
        new(Compose);

    private static IReadOnlyDictionary<string, CorePermissionDefinition> ByKey => ByKeyLazy.Value;

    private static IReadOnlyDictionary<string, CorePermissionDefinition> Compose()
    {
        var map = new Dictionary<string, CorePermissionDefinition>(StringComparer.Ordinal);

        foreach (var definition in CorePermissionCatalog.All)
        {
            AddOrVerify(map, definition);
        }

        foreach (var contribution in ModulePermissionRegistry.All)
        {
            foreach (var definition in contribution.Definitions)
            {
                AddOrVerify(map, definition);
            }
        }

        return map;
    }

    private static void AddOrVerify(
        IDictionary<string, CorePermissionDefinition> map,
        CorePermissionDefinition definition)
    {
        if (map.TryGetValue(definition.Key, out var existing))
        {
            // A module may legitimately re-contribute a Core-owned definition (the CoreHR
            // contribution is literally the Core slice). An identical redeclaration is fine;
            // a divergent one is a conflict we surface instead of silently resolving.
            if (!existing.Equals(definition))
            {
                throw new InvalidOperationException(
                    $"Conflicting permission definitions were contributed for key '{definition.Key}'. "
                    + "A permission key must be owned by exactly one module with one definition.");
            }

            return;
        }

        map[definition.Key] = definition;
    }

    /// <summary>Every permission definition across all registered module slices.</summary>
    public static IReadOnlyList<CorePermissionDefinition> All => ByKey.Values.ToList();

    public static bool IsKnown(string key) => ByKey.ContainsKey(key);

    public static bool TryGet(string key, out CorePermissionDefinition? definition)
        => ByKey.TryGetValue(key, out definition);

    public static CorePermissionDefinition Get(string key)
        => ByKey.TryGetValue(key, out var definition)
            ? definition
            : throw new InvalidOperationException($"Unknown permission '{key}'.");

    public static bool IsValidScope(string key, string scope)
        => ByKey.TryGetValue(key, out var definition)
            && !string.IsNullOrWhiteSpace(scope)
            && definition.AllowedScopes.Contains(scope, StringComparer.Ordinal);

    public static EffectivePermissionGrant? NormalizeGrant(string permissionKey, string scope)
        => IsKnown(permissionKey) && IsValidScope(permissionKey, scope)
            ? new EffectivePermissionGrant(permissionKey, scope)
            : null;
}
