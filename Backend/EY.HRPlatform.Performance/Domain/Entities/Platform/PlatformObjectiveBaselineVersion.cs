using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

public enum BaselineVersionStatus { Published, Superseded }

/// <summary>
/// Immutable-once-published content version of the platform baseline policy.
/// Published → Superseded.
/// </summary>
public class PlatformObjectiveBaselineVersion : BaseEntity
{
    private PlatformObjectiveBaselineVersion() { }

    public Guid BaselineId { get; private set; }
    public int VersionNumber { get; private set; }
    public BaselineVersionStatus Status { get; private set; }

    public int MaxObjectivesPerPlan { get; private set; }

    /// <summary>JSON array of allowed weight percentages, e.g. "[25,50,75,100]".</summary>
    public string AllowedWeightValues { get; private set; } = string.Empty;

    public int ManagerValidationSlaDays { get; private set; }

    /// <summary>Disabled | Optional | Required.</summary>
    public string CascadeMode { get; private set; } = string.Empty;

    /// <summary>Comma-separated: Quantitative, Qualitative, or both.</summary>
    public string MeasurementTypes { get; private set; } = string.Empty;

    public bool AttachmentsEnabled { get; private set; }

    public DateTime? PublishedAt { get; private set; }
    public DateTime? SupersededAt { get; private set; }

    internal static PlatformObjectiveBaselineVersion CreateApplied(
        Guid baselineId,
        int versionNumber,
        int maxObjectives,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled)
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
            Status = BaselineVersionStatus.Published,
            MaxObjectivesPerPlan = maxObjectives,
            AllowedWeightValues = allowedWeightValues.Trim(),
            ManagerValidationSlaDays = managerValidationSlaDays,
            CascadeMode = cascadeMode.Trim(),
            MeasurementTypes = measurementTypes.Trim(),
            AttachmentsEnabled = attachmentsEnabled,
            PublishedAt = DateTime.UtcNow,
        };
    }

    internal void Supersede()
    {
        if (Status != BaselineVersionStatus.Published)
            throw new DomainRuleViolationException("Only a Published version can be superseded.");

        Status = BaselineVersionStatus.Superseded;
        SupersededAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}
