using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class DraftOrgUnit : BaseEntity, ITenantEntity
{
    private DraftOrgUnit() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }

    /// <summary>
    /// Unique code within the draft workspace. Normalized to uppercase.
    /// </summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>
    /// Display name. Unique within the draft workspace for a tenant.
    /// </summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>
    /// Type of draft org unit. Must match the tenant's currently allowed org unit types.
    /// </summary>
    public string Type { get; private set; } = string.Empty;

    /// <summary>
    /// Parent draft org unit ID for hierarchy. Null means root node.
    /// </summary>
    public Guid? ParentId { get; private set; }

    /// <summary>
    /// Navigation property to parent draft org unit.
    /// </summary>
    public DraftOrgUnit? Parent { get; private set; }

    public static DraftOrgUnit Create(
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

        return new DraftOrgUnit
        {
            TenantId = tenantId,
            Code = code.Trim().ToUpperInvariant(),
            Name = name.Trim(),
            Type = type.Trim(),
            ParentId = parentId
        };
    }

    public void Update(string code, string name, string type, Guid? parentId)
    {
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

        if (parentId == Id)
            throw new ArgumentException("A structure item cannot be its own parent.", nameof(parentId));

        Code = code.Trim().ToUpperInvariant();
        Name = name.Trim();
        Type = type.Trim();
        ParentId = parentId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reparent(Guid? parentId)
    {
        if (parentId == Guid.Empty)
            parentId = null;

        if (parentId == Id)
            throw new ArgumentException("A structure item cannot be its own parent.", nameof(parentId));

        ParentId = parentId;
        UpdatedAt = DateTime.UtcNow;
    }
}