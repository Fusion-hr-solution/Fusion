using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities.Skills;

/// <summary>
/// A flat, tenant-owned grouping label for skills. Names are unique per tenant
/// among non-archived categories. Categories are archived, never deleted.
/// </summary>
public sealed class SkillCategory : AggregateRoot, ITenantEntity
{
    public const int NameMaxLength = 80;

    private SkillCategory() { }

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public SkillLifecycleStatus Status { get; private set; }
    public uint Version { get; private set; }

    public static SkillCategory Create(Guid tenantId, string name)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));

        var category = new SkillCategory
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Status = SkillLifecycleStatus.Active
        };
        category.Rename(name);
        return category;
    }

    public void Rename(string name)
    {
        EnsureNotArchived();
        Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status != SkillLifecycleStatus.Active)
            throw new DomainRuleViolationException("Only an active skill category can be archived.");

        Status = SkillLifecycleStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    private void EnsureNotArchived()
    {
        if (Status == SkillLifecycleStatus.Archived)
            throw new DomainRuleViolationException("An archived skill category is read-only.");
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A skill category requires a name.");

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }
}
