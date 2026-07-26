using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities.Skills;

/// <summary>
/// An ordered, tenant-owned level within a proficiency scale. Its numeric value
/// is always derived from <see cref="Ordinal"/>. A distinct concept from an
/// evaluation rating scale level — never reuse that type here.
/// </summary>
public sealed class ProficiencyScaleLevel : BaseEntity, ITenantEntity
{
    public const int LabelMaxLength = 80;
    public const int DescriptionMaxLength = 300;

    private ProficiencyScaleLevel() { }

    public Guid TenantId { get; private set; }
    public Guid ProficiencyScaleId { get; private set; }
    public int Ordinal { get; private set; }
    public int Value => Ordinal;
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }

    internal static ProficiencyScaleLevel Create(
        Guid tenantId,
        Guid proficiencyScaleId,
        int ordinal,
        string label,
        string? description)
    {
        var level = new ProficiencyScaleLevel
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ProficiencyScaleId = proficiencyScaleId
        };
        level.Update(ordinal, label, description);
        return level;
    }

    internal void Update(int ordinal, string label, string? description)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A proficiency level ordinal must be positive.");

        Ordinal = ordinal;
        Label = NormalizeRequired(label, nameof(label), LabelMaxLength);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetOrdinal(int ordinal)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A proficiency level ordinal must be positive.");

        Ordinal = ordinal;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A proficiency level requires a label.");

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

public sealed record ProficiencyScaleLevelDraft(
    string Label,
    string? Description = null);
