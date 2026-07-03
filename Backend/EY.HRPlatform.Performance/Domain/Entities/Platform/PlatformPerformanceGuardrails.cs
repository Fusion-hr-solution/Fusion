using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

/// <summary>
/// Singleton platform entity holding hard system-supported guardrail bounds.
/// Not tenant-scoped: no TenantId, no global query filter, gated by PlatformRole.PlatformAdmin.
/// </summary>
public class PlatformPerformanceGuardrails : BaseEntity
{
    private PlatformPerformanceGuardrails() { }

    /// <summary>Row version for optimistic concurrency (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public int MinObjectivesPerPlan { get; private set; }
    public int MaxObjectivesPerPlan { get; private set; }
    public int MinManagerValidationSlaDays { get; private set; }
    public int MaxManagerValidationSlaDays { get; private set; }

    /// <summary>Permitted decimal precision for weight percentages (e.g. 0 = integers only).</summary>
    public int PermittedWeightDecimalPlaces { get; private set; }

    /// <summary>Maximum number of distinct allowed weighting values a tenant policy may define.</summary>
    public int MaxAllowedWeightingValues { get; private set; }

    /// <summary>Comma-separated supported measurement types (Quantitative, Qualitative).</summary>
    public string SupportedMeasurementTypes { get; private set; } = "Quantitative,Qualitative";

    public int MaxTemplateTitleLength { get; private set; }
    public int MaxTemplateDescriptionLength { get; private set; }
    public int MaxTemplateTags { get; private set; }

    public static PlatformPerformanceGuardrails CreateApplied(
        int minObjectives,
        int maxObjectives,
        int minSlaDays,
        int maxSlaDays,
        int permittedWeightDecimalPlaces,
        int maxAllowedWeightingValues,
        string supportedMeasurementTypes,
        int maxTitleLength,
        int maxDescriptionLength,
        int maxTags)
    {
        ValidateBounds(minObjectives, maxObjectives, minSlaDays, maxSlaDays,
            permittedWeightDecimalPlaces, maxAllowedWeightingValues,
            maxTitleLength, maxDescriptionLength, maxTags);

        return new PlatformPerformanceGuardrails
        {
            Id = Guid.NewGuid(),
            MinObjectivesPerPlan = minObjectives,
            MaxObjectivesPerPlan = maxObjectives,
            MinManagerValidationSlaDays = minSlaDays,
            MaxManagerValidationSlaDays = maxSlaDays,
            PermittedWeightDecimalPlaces = permittedWeightDecimalPlaces,
            MaxAllowedWeightingValues = maxAllowedWeightingValues,
            SupportedMeasurementTypes = supportedMeasurementTypes.Trim(),
            MaxTemplateTitleLength = maxTitleLength,
            MaxTemplateDescriptionLength = maxDescriptionLength,
            MaxTemplateTags = maxTags,
        };
    }

    /// <summary>
    /// Atomically updates the applied singleton in place.
    /// </summary>
    public void Apply(
        int minObjectives,
        int maxObjectives,
        int minSlaDays,
        int maxSlaDays,
        int permittedWeightDecimalPlaces,
        int maxAllowedWeightingValues,
        string supportedMeasurementTypes,
        int maxTitleLength,
        int maxDescriptionLength,
        int maxTags)
    {
        ValidateBounds(minObjectives, maxObjectives, minSlaDays, maxSlaDays,
            permittedWeightDecimalPlaces, maxAllowedWeightingValues,
            maxTitleLength, maxDescriptionLength, maxTags);

        MinObjectivesPerPlan = minObjectives;
        MaxObjectivesPerPlan = maxObjectives;
        MinManagerValidationSlaDays = minSlaDays;
        MaxManagerValidationSlaDays = maxSlaDays;
        PermittedWeightDecimalPlaces = permittedWeightDecimalPlaces;
        MaxAllowedWeightingValues = maxAllowedWeightingValues;
        SupportedMeasurementTypes = supportedMeasurementTypes.Trim();
        MaxTemplateTitleLength = maxTitleLength;
        MaxTemplateDescriptionLength = maxDescriptionLength;
        MaxTemplateTags = maxTags;
        UpdatedAt = DateTime.UtcNow;
    }

    private static void ValidateBounds(
        int minObjectives, int maxObjectives,
        int minSlaDays, int maxSlaDays,
        int permittedWeightDecimalPlaces, int maxAllowedWeightingValues,
        int maxTitleLength, int maxDescriptionLength, int maxTags)
    {
        if (minObjectives < 1)
            throw new ArgumentException("MinObjectivesPerPlan must be at least 1.", nameof(minObjectives));
        if (maxObjectives < minObjectives)
            throw new ArgumentException("MaxObjectivesPerPlan must be >= MinObjectivesPerPlan.", nameof(maxObjectives));
        if (minSlaDays < 0)
            throw new ArgumentException("MinManagerValidationSlaDays cannot be negative.", nameof(minSlaDays));
        if (maxSlaDays < minSlaDays)
            throw new ArgumentException("MaxManagerValidationSlaDays must be >= MinManagerValidationSlaDays.", nameof(maxSlaDays));
        if (permittedWeightDecimalPlaces < 0)
            throw new ArgumentException("PermittedWeightDecimalPlaces cannot be negative.", nameof(permittedWeightDecimalPlaces));
        if (maxAllowedWeightingValues < 1)
            throw new ArgumentException("MaxAllowedWeightingValues must be at least 1.", nameof(maxAllowedWeightingValues));
        if (maxTitleLength < 10)
            throw new ArgumentException("MaxTemplateTitleLength must be at least 10.", nameof(maxTitleLength));
        if (maxDescriptionLength < maxTitleLength)
            throw new ArgumentException("MaxTemplateDescriptionLength must be >= MaxTemplateTitleLength.", nameof(maxDescriptionLength));
        if (maxTags < 0)
            throw new ArgumentException("MaxTemplateTags cannot be negative.", nameof(maxTags));
    }
}
