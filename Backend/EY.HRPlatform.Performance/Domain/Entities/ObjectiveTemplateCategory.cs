using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public enum CategoryStatus { Active, Archived }

/// <summary>
/// Tenant-scoped template category. Code and normalized name are unique per tenant.
/// </summary>
public class ObjectiveTemplateCategory : BaseEntity, ITenantEntity
{
    private ObjectiveTemplateCategory() { }

    public Guid TenantId { get; private set; }

    /// <summary>Short machine-readable identifier, e.g. "LEADERSHIP". Immutable after creation.</summary>
    public string Code { get; private set; } = string.Empty;

    /// <summary>Human-readable label as entered by the user.</summary>
    public string Name { get; private set; } = string.Empty;

    /// <summary>Lowercase, trimmed version of Name used for uniqueness checks.</summary>
    public string NormalizedName { get; private set; } = string.Empty;

    public CategoryStatus Status { get; private set; }

    public static ObjectiveTemplateCategory Create(Guid tenantId, string code, string name)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Code cannot be empty.", nameof(code));
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name cannot be empty.", nameof(name));

        var normalizedCode = code.Trim().ToUpperInvariant();
        if (normalizedCode.Length > 50)
            throw new ArgumentException("Code cannot exceed 50 characters.", nameof(code));

        var trimmedName = name.Trim();
        if (trimmedName.Length > 100)
            throw new ArgumentException("Name cannot exceed 100 characters.", nameof(name));

        return new ObjectiveTemplateCategory
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Code = normalizedCode,
            Name = trimmedName,
            NormalizedName = trimmedName.ToLowerInvariant(),
            Status = CategoryStatus.Active,
        };
    }

    public void Rename(string newName)
    {
        if (Status == CategoryStatus.Archived)
            throw new DomainRuleViolationException("Cannot rename an archived category.");
        if (string.IsNullOrWhiteSpace(newName))
            throw new ArgumentException("Name cannot be empty.", nameof(newName));

        var trimmed = newName.Trim();
        if (trimmed.Length > 100)
            throw new ArgumentException("Name cannot exceed 100 characters.", nameof(newName));

        Name = trimmed;
        NormalizedName = trimmed.ToLowerInvariant();
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status == CategoryStatus.Archived)
            throw new DomainRuleViolationException("Category is already archived.");

        Status = CategoryStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Reactivate()
    {
        if (Status == CategoryStatus.Active)
            throw new DomainRuleViolationException("Category is already active.");

        Status = CategoryStatus.Active;
        UpdatedAt = DateTime.UtcNow;
    }
}
