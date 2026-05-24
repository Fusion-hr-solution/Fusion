using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

public static class AccessProfileTypes
{
    public const string SystemSeeded = "SystemSeeded";
    public const string Custom = "Custom";
}

public class AccessProfile : BaseEntity, ITenantEntity
{
    private AccessProfile() { }

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string Type { get; private set; } = AccessProfileTypes.Custom;
    public bool IsSystemProtected { get; private set; }
    public uint Version { get; private set; }

    public List<AccessProfileGrant> Grants { get; private set; } = [];
    public List<UserAccessProfile> UserAssignments { get; private set; } = [];
    public List<InviteAccessProfile> InviteAssignments { get; private set; } = [];

    public static AccessProfile Create(
        Guid tenantId,
        string name,
        string? description,
        string type,
        bool isSystemProtected)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));

        var normalizedName = NormalizeName(name);
        if (type is not AccessProfileTypes.SystemSeeded and not AccessProfileTypes.Custom)
            throw new ArgumentException($"Invalid access profile type '{type}'.", nameof(type));

        return new AccessProfile
        {
            TenantId = tenantId,
            Name = normalizedName,
            NormalizedName = normalizedName.ToUpperInvariant(),
            Description = NormalizeDescription(description),
            Type = type,
            IsSystemProtected = isSystemProtected,
        };
    }

    public void UpdateDetails(string name, string? description)
    {
        var normalizedName = NormalizeName(name);
        Name = normalizedName;
        NormalizedName = normalizedName.ToUpperInvariant();
        Description = NormalizeDescription(description);
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkSystemState(string type, bool isSystemProtected)
    {
        if (type is not AccessProfileTypes.SystemSeeded and not AccessProfileTypes.Custom)
            throw new ArgumentException($"Invalid access profile type '{type}'.", nameof(type));

        Type = type;
        IsSystemProtected = isSystemProtected;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReplaceGrants(IEnumerable<AccessProfileGrant> grants)
    {
        Grants.Clear();
        Grants.AddRange(grants);
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Access profile name is required.", nameof(name));

        return name.Trim();
    }

    private static string? NormalizeDescription(string? description)
        => string.IsNullOrWhiteSpace(description) ? null : description.Trim();
}
