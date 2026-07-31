using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

public enum StartingConfigurationVersionStatus { Current, Replaced }

/// <summary>
/// Immutable applied version of the platform starting objective planning configuration.
/// </summary>
public class PlatformObjectiveBaselineVersion : BaseEntity
{
    private PlatformObjectiveBaselineVersion() { }

    public Guid BaselineId { get; private set; }
    public int VersionNumber { get; private set; }
    public StartingConfigurationVersionStatus Status { get; private set; }

    public int MaxObjectivesPerPlan { get; private set; }

    /// <summary>JSON array of allowed weight percentages, e.g. "[25,50,75,100]".</summary>
    public string AllowedWeightValues { get; private set; } = string.Empty;

    /// <summary>Comma-separated: Quantitative, Qualitative, or both.</summary>
    public string MeasurementTypes { get; private set; } = string.Empty;

    public DateTime? AppliedAt { get; private set; }
    public DateTime? ReplacedAt { get; private set; }

    internal static PlatformObjectiveBaselineVersion CreateApplied(
        Guid baselineId,
        int versionNumber,
        int maxObjectives,
        string allowedWeightValues,
        string measurementTypes)
    {
        if (baselineId == Guid.Empty)
            throw new ArgumentException("BaselineId cannot be empty.", nameof(baselineId));
        if (maxObjectives < 1)
            throw new ArgumentException("MaxObjectivesPerPlan must be at least 1.", nameof(maxObjectives));
        if (string.IsNullOrWhiteSpace(allowedWeightValues))
            throw new ArgumentException("AllowedWeightValues cannot be empty.", nameof(allowedWeightValues));
        if (string.IsNullOrWhiteSpace(measurementTypes))
            throw new ArgumentException("MeasurementTypes cannot be empty.", nameof(measurementTypes));

        return new PlatformObjectiveBaselineVersion
        {
            Id = Guid.NewGuid(),
            BaselineId = baselineId,
            VersionNumber = versionNumber,
            Status = StartingConfigurationVersionStatus.Current,
            MaxObjectivesPerPlan = maxObjectives,
            AllowedWeightValues = allowedWeightValues.Trim(),
            MeasurementTypes = measurementTypes.Trim(),
            AppliedAt = DateTime.UtcNow,
        };
    }

    internal void Replace()
    {
        if (Status != StartingConfigurationVersionStatus.Current)
            throw new DomainRuleViolationException("Only a current starting configuration can be replaced.");

        Status = StartingConfigurationVersionStatus.Replaced;
        ReplacedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
