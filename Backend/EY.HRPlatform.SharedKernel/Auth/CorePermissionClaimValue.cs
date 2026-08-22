namespace EY.HRPlatform.SharedKernel.Auth;

public static class CorePermissionClaimValue
{
    private const char Separator = '|';

    public static string Encode(string permissionKey, string scope)
    {
        var normalized = PermissionCatalog.NormalizeGrant(permissionKey, scope)
            ?? throw new ArgumentException($"Invalid permission grant '{permissionKey}' / '{scope}'.", nameof(permissionKey));

        return $"{normalized.PermissionKey}{Separator}{normalized.Scope}";
    }

    public static bool TryDecode(string value, out EffectivePermissionGrant? grant)
    {
        grant = null;

        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var separatorIndex = value.IndexOf(Separator);
        if (separatorIndex <= 0 || separatorIndex >= value.Length - 1)
        {
            return false;
        }

        var permissionKey = value[..separatorIndex];
        var scope = value[(separatorIndex + 1)..];
        grant = PermissionCatalog.NormalizeGrant(permissionKey, scope);
        return grant is not null;
    }
}
