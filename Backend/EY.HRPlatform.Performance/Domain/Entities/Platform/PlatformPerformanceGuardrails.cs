using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

/// <summary>
/// Singleton platform entity holding the system-supported objective-planning limits.
/// Not tenant-scoped: no TenantId, no global query filter, gated by PlatformRole.PlatformAdmin.
/// Lean scope: max objective count, supported allowed weights, and Quantitative/Qualitative availability.
/// </summary>
public class PlatformPerformanceGuardrails : BaseEntity
{
    private const int MaxWeightChoices = 10;

    private PlatformPerformanceGuardrails() { }

    /// <summary>Row version for optimistic concurrency (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public int MaxObjectivesPerPlan { get; private set; }

    /// <summary>Comma-separated platform-supported weight percentages tenants may choose from.</summary>
    public string SupportedAllowedWeightValues { get; private set; } = "5,10,15,20,25,30,40,50";

    public bool QuantitativeAvailable { get; private set; } = true;
    public bool QualitativeAvailable { get; private set; } = true;

    public static PlatformPerformanceGuardrails CreateApplied(
        int maxObjectivesPerPlan,
        string supportedAllowedWeightValues,
        bool quantitativeAvailable,
        bool qualitativeAvailable)
    {
        Validate(maxObjectivesPerPlan, supportedAllowedWeightValues, quantitativeAvailable, qualitativeAvailable);

        return new PlatformPerformanceGuardrails
        {
            Id = Guid.NewGuid(),
            MaxObjectivesPerPlan = maxObjectivesPerPlan,
            SupportedAllowedWeightValues = NormalizeWeights(supportedAllowedWeightValues),
            QuantitativeAvailable = quantitativeAvailable,
            QualitativeAvailable = qualitativeAvailable,
        };
    }

    /// <summary>
    /// Atomically updates the applied singleton in place.
    /// </summary>
    public void Apply(
        int maxObjectivesPerPlan,
        string supportedAllowedWeightValues,
        bool quantitativeAvailable,
        bool qualitativeAvailable)
    {
        Validate(maxObjectivesPerPlan, supportedAllowedWeightValues, quantitativeAvailable, qualitativeAvailable);

        MaxObjectivesPerPlan = maxObjectivesPerPlan;
        SupportedAllowedWeightValues = NormalizeWeights(supportedAllowedWeightValues);
        QuantitativeAvailable = quantitativeAvailable;
        QualitativeAvailable = qualitativeAvailable;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void Validate(
        int maxObjectivesPerPlan,
        string supportedAllowedWeightValues,
        bool quantitativeAvailable,
        bool qualitativeAvailable)
    {
        if (maxObjectivesPerPlan < 1)
            throw new ArgumentException("Maximum objective count must be at least 1.", nameof(maxObjectivesPerPlan));
        if (!quantitativeAvailable && !qualitativeAvailable)
            throw new ArgumentException("At least one measurement method must be available.");
        var weights = ParseWeightSet(supportedAllowedWeightValues);
        if (weights.Count == 0)
            throw new ArgumentException("At least one supported weight is required.", nameof(supportedAllowedWeightValues));
        if (weights.Count > MaxWeightChoices)
            throw new ArgumentException($"Supported objective weights must use no more than {MaxWeightChoices} choices.", nameof(supportedAllowedWeightValues));
    }

    private static IReadOnlyList<int> ParseWeightSet(string values)
    {
        var parsed = new List<int>();
        foreach (var token in values.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!int.TryParse(token, out var weight) || weight is < 1 or > 100)
                throw new ArgumentException("Supported objective weights must be whole percentages from 1% to 100%.", nameof(values));
            if (weight % 5 != 0)
                throw new ArgumentException("Supported objective weights must use 5% increments.", nameof(values));
            parsed.Add(weight);
        }

        if (parsed.Count != parsed.Distinct().Count())
            throw new ArgumentException("Supported objective weights cannot contain duplicate values.", nameof(values));

        return parsed.Order().ToList();
    }

    private static string NormalizeWeights(string values)
        => string.Join(",", ParseWeightSet(values));
}
