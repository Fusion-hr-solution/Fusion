using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// The immutable review definition used by a campaign. It deliberately copies the
/// criteria and rating scale so later catalog changes cannot alter an active or closed review.
/// </summary>
public sealed class FormalReviewDefinitionSnapshot : AggregateRoot, ITenantEntity
{
    private readonly List<FormalReviewCriterionSnapshot> _criteria = [];
    private readonly List<FormalRatingScaleLevelSnapshot> _ratingScaleLevels = [];

    private FormalReviewDefinitionSnapshot() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public FormalReviewKind Kind { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string RatingScaleName { get; private set; } = string.Empty;
    public DateTime FrozenAt { get; private set; }
    public IReadOnlyCollection<FormalReviewCriterionSnapshot> Criteria => _criteria.AsReadOnly();
    public IReadOnlyCollection<FormalRatingScaleLevelSnapshot> RatingScaleLevels => _ratingScaleLevels.AsReadOnly();

    public static FormalReviewDefinitionSnapshot Create(
        Guid tenantId,
        Guid cycleId,
        FormalReviewKind kind,
        string name,
        IEnumerable<ReviewCriterionDefinition> criteria,
        string ratingScaleName,
        IEnumerable<RatingScaleLevelDefinition> ratingScaleLevels,
        DateTime frozenAt)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty)
            throw new ArgumentException("Tenant and campaign are required.");
        if (!Enum.IsDefined(kind))
            throw new ArgumentOutOfRangeException(nameof(kind));

        var criterionValues = criteria?.OrderBy(item => item.DisplayOrder).ToList()
            ?? throw new ArgumentNullException(nameof(criteria));
        if (criterionValues.Count == 0 || criterionValues.Any(item => string.IsNullOrWhiteSpace(item.Name)) ||
            criterionValues.Select(item => item.DisplayOrder).Distinct().Count() != criterionValues.Count)
            throw new ArgumentException("A review definition requires uniquely ordered criteria.", nameof(criteria));

        var scaleValues = ratingScaleLevels?.OrderBy(item => item.Value).ToList()
            ?? throw new ArgumentNullException(nameof(ratingScaleLevels));
        if (scaleValues.Count == 0 || scaleValues.Any(item => item.Value <= 0 || string.IsNullOrWhiteSpace(item.Label)) ||
            scaleValues.Select(item => item.Value).Distinct().Count() != scaleValues.Count)
            throw new ArgumentException("A rating scale requires uniquely valued, positive levels.", nameof(ratingScaleLevels));

        var definition = new FormalReviewDefinitionSnapshot
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            Kind = kind,
            Name = Required(name, 200, nameof(name)),
            RatingScaleName = Required(ratingScaleName, 120, nameof(ratingScaleName)),
            FrozenAt = NormalizeUtc(frozenAt)
        };
        definition._criteria.AddRange(criterionValues.Select(item => FormalReviewCriterionSnapshot.Create(
            tenantId, definition.Id, item.Name, item.Description, item.DisplayOrder)));
        definition._ratingScaleLevels.AddRange(scaleValues.Select(item => FormalRatingScaleLevelSnapshot.Create(
            tenantId, definition.Id, item.Value, item.Label, item.Description)));
        return definition;
    }

    private static string Required(string value, int maximum, string parameterName)
    {
        if (string.IsNullOrWhiteSpace(value))
            throw new ArgumentException("A value is required.", parameterName);
        var normalized = value.Trim();
        if (normalized.Length > maximum)
            throw new ArgumentOutOfRangeException(parameterName, $"Value cannot exceed {maximum} characters.");
        return normalized;
    }

    private static DateTime NormalizeUtc(DateTime value)
    {
        if (value == default) throw new ArgumentException("A frozen timestamp is required.", nameof(value));
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc)
        };
    }
}

public sealed record ReviewCriterionDefinition(string Name, string? Description, int DisplayOrder);
public sealed record RatingScaleLevelDefinition(int Value, string Label, string? Description = null);
