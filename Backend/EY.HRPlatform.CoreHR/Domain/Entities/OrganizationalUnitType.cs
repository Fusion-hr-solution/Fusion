using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>Global built-ins have no tenant; custom vocabulary belongs to one tenant.</summary>
public sealed class OrganizationalUnitType : BaseEntity
{
    private OrganizationalUnitType() { }

    public Guid? TenantId { get; private set; }
    public bool IsBuiltIn { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;

    public static OrganizationalUnitType CreateBuiltIn(Guid id, string name)
    {
        var type = CreateCustom(null, name);
        type.Id = id;
        type.IsBuiltIn = true;
        return type;
    }

    public static OrganizationalUnitType CreateCustom(Guid? tenantId, string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 100)
            throw new ArgumentException("A type name of at most 100 characters is required.", nameof(name));

        return new OrganizationalUnitType
        {
            TenantId = tenantId,
            DisplayName = name.Trim(),
            NormalizedName = name.Trim().ToUpperInvariant(),
        };
    }

    public void Rename(string name)
    {
        if (IsBuiltIn)
            throw new InvalidOperationException("Built-in Organizational Unit Types cannot be renamed.");

        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 100)
            throw new ArgumentException("A type name of at most 100 characters is required.", nameof(name));

        DisplayName = name.Trim();
        NormalizedName = DisplayName.ToUpperInvariant();
        UpdatedAt = DateTime.UtcNow;
    }
}
