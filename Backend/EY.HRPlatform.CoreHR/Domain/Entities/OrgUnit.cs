using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class OrgUnit : AggregateRoot, ITenantEntity
{
    private OrgUnit() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }

    /// <summary>
    /// Unique code within tenant. Normalized to uppercase.
    /// </summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>
    /// Display name. Unique within tenant.
    /// </summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// Type of org unit (e.g., "Department", "Team"). Must match tenant's configured orgUnitTypes.
    /// </summary>
    public string Type { get; private set; } = string.Empty;

    /// <summary>
    /// Parent org unit ID for hierarchy. Null means root node.
    /// </summary>
    public Guid? ParentId { get; private set; }

    /// <summary>
    /// Navigation property to parent org unit.
    /// </summary>
    public OrgUnit? Parent { get; private set; }

    /// <summary>
    /// Soft delete flag.
    /// </summary>
    public bool IsActive { get; private set; }

    public static OrgUnit Create(
        Guid tenantId,
        string code,
        string name,
        string type,
        Guid? parentId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code cannot be empty.", nameof(code));

        if (code.Length > 50)
            throw new ArgumentException("Code cannot exceed 50 characters.", nameof(code));

        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty.", nameof(name));

        if (name.Length > 200)
            throw new ArgumentException("Name cannot exceed 200 characters.", nameof(name));

        if (string.IsNullOrWhiteSpace(type))
            throw new ArgumentException("Type cannot be empty.", nameof(type));

        if (parentId == Guid.Empty)
            parentId = null;

        return new OrgUnit
        {
            TenantId = tenantId,
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Type = type.Trim(),
            ParentId = parentId,
            IsActive = true
        };
    }

    public void Update(string name, string type, Guid? parentId)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty.", nameof(name));

        if (name.Length > 200)
            throw new ArgumentException("Name cannot exceed 200 characters.", nameof(name));

        if (string.IsNullOrWhiteSpace(type))
            throw new ArgumentException("Type cannot be empty.", nameof(type));

        if (parentId == Guid.Empty)
            parentId = null;

        if (parentId == Id)
            throw new ArgumentException("Org unit cannot be its own parent.", nameof(parentId));

        Name = name.Trim();
        Type = type.Trim();
        ParentId = parentId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (!IsActive)
            throw new InvalidOperationException("Org unit is already inactive.");

        IsActive = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Activate()
    {
        if (IsActive)
            throw new InvalidOperationException("Org unit is already active.");

        IsActive = true;
        UpdatedAt = DateTime.UtcNow;
    }
}
