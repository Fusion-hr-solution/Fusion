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
    /// Stable business reference key for this structure item.
    /// </summary>
    public string ReferenceKey { get; private set; } = string.Empty;

    /// <summary>
    /// Internal normalized reference key used for case-insensitive uniqueness.
    /// </summary>
    public string NormalizedReferenceKey { get; private set; } = string.Empty;

    /// <summary>
    /// Human-facing display name.
    /// </summary>
    public string DisplayName { get; private set; } = string.Empty;

    /// <summary>
    /// Controlled tenant-resolved org-unit kind key.
    /// </summary>
    public string OrgUnitKindKey { get; private set; } = string.Empty;

    /// <summary>
    /// Optional business-facing code. Not the canonical identity.
    /// </summary>
    public string? BusinessCode { get; private set; }

    /// <summary>
    /// Optional business-facing description.
    /// </summary>
    public string? Description { get; private set; }

    /// <summary>
    /// JSON payload for manifest-governed attributes.
    /// </summary>
    public string? AttributesJson { get; private set; }

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
        string referenceKey,
        string displayName,
        string orgUnitKindKey,
        string? businessCode,
        string? description,
        string? attributesJson,
        Guid? parentId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (string.IsNullOrWhiteSpace(referenceKey))
            throw new ArgumentException("ReferenceKey cannot be empty.", nameof(referenceKey));

        if (referenceKey.Trim().Length > 150)
            throw new ArgumentException("ReferenceKey cannot exceed 150 characters.", nameof(referenceKey));

        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("DisplayName cannot be empty.", nameof(displayName));

        if (displayName.Trim().Length > 200)
            throw new ArgumentException("DisplayName cannot exceed 200 characters.", nameof(displayName));

        if (string.IsNullOrWhiteSpace(orgUnitKindKey))
            throw new ArgumentException("OrgUnitKindKey cannot be empty.", nameof(orgUnitKindKey));

        if (!string.IsNullOrWhiteSpace(businessCode) && businessCode.Trim().Length > 100)
            throw new ArgumentException("BusinessCode cannot exceed 100 characters.", nameof(businessCode));

        if (!string.IsNullOrWhiteSpace(description) && description.Trim().Length > 500)
            throw new ArgumentException("Description cannot exceed 500 characters.", nameof(description));

        if (parentId == Guid.Empty)
            parentId = null;

        var normalizedReferenceKey = NormalizeReferenceKey(referenceKey);

        return new DraftOrgUnit
        {
            TenantId = tenantId,
            ReferenceKey = referenceKey.Trim(),
            NormalizedReferenceKey = normalizedReferenceKey,
            DisplayName = displayName.Trim(),
            OrgUnitKindKey = NormalizeKindKey(orgUnitKindKey),
            BusinessCode = NormalizeOptionalText(businessCode),
            Description = NormalizeOptionalText(description),
            AttributesJson = NormalizeOptionalJson(attributesJson),
            ParentId = parentId
        };
    }

    public void Update(
        string referenceKey,
        string displayName,
        string orgUnitKindKey,
        string? businessCode,
        string? description,
        string? attributesJson,
        Guid? parentId)
    {
        if (string.IsNullOrWhiteSpace(referenceKey))
            throw new ArgumentException("ReferenceKey cannot be empty.", nameof(referenceKey));

        if (referenceKey.Trim().Length > 150)
            throw new ArgumentException("ReferenceKey cannot exceed 150 characters.", nameof(referenceKey));

        if (string.IsNullOrWhiteSpace(displayName))
            throw new ArgumentException("DisplayName cannot be empty.", nameof(displayName));

        if (displayName.Trim().Length > 200)
            throw new ArgumentException("DisplayName cannot exceed 200 characters.", nameof(displayName));

        if (string.IsNullOrWhiteSpace(orgUnitKindKey))
            throw new ArgumentException("OrgUnitKindKey cannot be empty.", nameof(orgUnitKindKey));

        if (!string.IsNullOrWhiteSpace(businessCode) && businessCode.Trim().Length > 100)
            throw new ArgumentException("BusinessCode cannot exceed 100 characters.", nameof(businessCode));

        if (!string.IsNullOrWhiteSpace(description) && description.Trim().Length > 500)
            throw new ArgumentException("Description cannot exceed 500 characters.", nameof(description));

        if (parentId == Guid.Empty)
            parentId = null;

        if (parentId == Id)
            throw new ArgumentException("A structure item cannot be its own parent.", nameof(parentId));

        ReferenceKey = referenceKey.Trim();
        NormalizedReferenceKey = NormalizeReferenceKey(referenceKey);
        DisplayName = displayName.Trim();
        OrgUnitKindKey = NormalizeKindKey(orgUnitKindKey);
        BusinessCode = NormalizeOptionalText(businessCode);
        Description = NormalizeOptionalText(description);
        AttributesJson = NormalizeOptionalJson(attributesJson);
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

    private static string NormalizeReferenceKey(string value)
        => value.Trim().ToUpperInvariant();

    private static string NormalizeKindKey(string value)
        => value.Trim().ToLowerInvariant();

    private static string? NormalizeOptionalText(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string? NormalizeOptionalJson(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value;
}