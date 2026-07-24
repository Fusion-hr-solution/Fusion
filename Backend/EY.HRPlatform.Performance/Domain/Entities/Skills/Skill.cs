using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities.Skills;

/// <summary>
/// A tenant-owned capability. Created active — a skill has no structural
/// composition to stage. Once referenced by a launched round it freezes:
/// rename and recategorize are blocked (duplicate-to-evolve), archive stays allowed.
/// </summary>
public sealed class Skill : AggregateRoot, ITenantEntity
{
    public const int NameMaxLength = 120;
    public const int DescriptionMaxLength = 500;

    private Skill() { }

    public Guid TenantId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public Guid SkillCategoryId { get; private set; }
    public SkillLifecycleStatus Status { get; private set; }
    public bool IsInUse { get; private set; }
    public uint Version { get; private set; }

    public static Skill Create(
        Guid tenantId,
        string name,
        string? description,
        Guid skillCategoryId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant is required.", nameof(tenantId));
        if (skillCategoryId == Guid.Empty)
            throw new DomainRuleViolationException("A skill requires a category.");

        var skill = new Skill
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            SkillCategoryId = skillCategoryId,
            Status = SkillLifecycleStatus.Active
        };
        skill.Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        skill.Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        return skill;
    }

    public void Update(string name, string? description, Guid skillCategoryId)
    {
        EnsureEditable();
        if (skillCategoryId == Guid.Empty)
            throw new DomainRuleViolationException("A skill requires a category.");

        Name = NormalizeRequired(name, nameof(name), NameMaxLength);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        SkillCategoryId = skillCategoryId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Archive()
    {
        if (Status != SkillLifecycleStatus.Active)
            throw new DomainRuleViolationException("Only an active skill can be archived.");

        Status = SkillLifecycleStatus.Archived;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkInUse()
    {
        if (Status != SkillLifecycleStatus.Active)
            throw new DomainRuleViolationException("Only an active skill can be used by a launched round.");

        IsInUse = true;
        UpdatedAt = DateTime.UtcNow;
    }

    private void EnsureEditable()
    {
        if (Status == SkillLifecycleStatus.Archived)
            throw new DomainRuleViolationException("An archived skill is read-only.");
        if (IsInUse)
            throw new DomainRuleViolationException(
                "This skill is in use. Duplicate it to change its name or category.");
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A skill requires a name.");

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }

    private static string? NormalizeOptional(string? value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            return null;

        var trimmed = value.Trim();
        if (trimmed.Length > maxLength)
            throw new ArgumentException($"{paramName} cannot exceed {maxLength} characters.", paramName);

        return trimmed;
    }
}
