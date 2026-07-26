using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An ordered, tenant-owned level within a discrete evaluation rating scale.
/// Its numeric value is always derived from <see cref="Ordinal"/>.
/// </summary>
public sealed class EvaluationRatingScaleLevel : BaseEntity, ITenantEntity
{
    public const int LabelMaxLength = 100;
    public const int DescriptionMaxLength = 300;
    public const int BehavioralGuidanceMaxLength = 500;

    private EvaluationRatingScaleLevel() { }

    public Guid TenantId { get; private set; }
    public Guid RatingScaleId { get; private set; }
    public int Ordinal { get; private set; }
    public int Value => Ordinal;
    public string Label { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public string? BehavioralGuidance { get; private set; }

    internal static EvaluationRatingScaleLevel Create(
        Guid tenantId,
        Guid ratingScaleId,
        int ordinal,
        string label,
        string? description,
        string? behavioralGuidance)
    {
        var level = new EvaluationRatingScaleLevel
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            RatingScaleId = ratingScaleId
        };
        level.Update(ordinal, label, description, behavioralGuidance);
        return level;
    }

    internal void Update(
        int ordinal,
        string label,
        string? description,
        string? behavioralGuidance)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A rating level ordinal must be positive.");

        Ordinal = ordinal;
        Label = NormalizeRequired(label, nameof(label), LabelMaxLength);
        Description = NormalizeOptional(description, nameof(description), DescriptionMaxLength);
        BehavioralGuidance = NormalizeOptional(
            behavioralGuidance,
            nameof(behavioralGuidance),
            BehavioralGuidanceMaxLength);
        UpdatedAt = DateTime.UtcNow;
    }

    internal void SetOrdinal(int ordinal)
    {
        if (ordinal < 1)
            throw new DomainRuleViolationException("A rating level ordinal must be positive.");

        Ordinal = ordinal;
        UpdatedAt = DateTime.UtcNow;
    }

    private static string NormalizeRequired(string value, string paramName, int maxLength)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new DomainRuleViolationException("A rating level requires a label.");

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

public sealed record EvaluationRatingScaleLevelDraft(
    string Label,
    string? Description = null,
    string? BehavioralGuidance = null);
