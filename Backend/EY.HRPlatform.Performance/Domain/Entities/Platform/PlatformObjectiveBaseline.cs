using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

/// <summary>
/// Stable identity for the platform baseline objective policy.
/// Not tenant-scoped. Versions hold the immutable published content.
/// </summary>
public class PlatformObjectiveBaseline : BaseEntity
{
    private readonly List<PlatformObjectiveBaselineVersion> _versions = [];

    private PlatformObjectiveBaseline() { }

    public IReadOnlyList<PlatformObjectiveBaselineVersion> Versions => _versions.AsReadOnly();

    public PlatformObjectiveBaselineVersion? PublishedVersion
        => _versions.SingleOrDefault(v => v.Status == BaselineVersionStatus.Published);

    public static PlatformObjectiveBaseline Create()
        => new() { Id = Guid.NewGuid() };

    public PlatformObjectiveBaselineVersion Apply(
        int maxObjectives,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled)
    {
        if (PublishedVersion is { } current)
            current.Supersede();

        var nextNumber = _versions.Count == 0 ? 1 : _versions.Max(v => v.VersionNumber) + 1;

        var version = PlatformObjectiveBaselineVersion.CreateApplied(
            Id, nextNumber, maxObjectives, allowedWeightValues,
            managerValidationSlaDays, cascadeMode, measurementTypes, attachmentsEnabled);

        _versions.Add(version);
        UpdatedAt = DateTime.UtcNow;
        return version;
    }
}
