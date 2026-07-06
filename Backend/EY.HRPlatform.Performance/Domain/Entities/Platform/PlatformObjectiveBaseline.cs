using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities.Platform;

/// <summary>
/// Stable identity for the platform starting objective planning configuration.
/// Not tenant-scoped. Versions hold the immutable applied content.
/// </summary>
public class PlatformObjectiveBaseline : BaseEntity
{
    private readonly List<PlatformObjectiveBaselineVersion> _versions = [];

    private PlatformObjectiveBaseline() { }

    public IReadOnlyList<PlatformObjectiveBaselineVersion> Versions => _versions.AsReadOnly();

    public PlatformObjectiveBaselineVersion? CurrentVersion
        => _versions.SingleOrDefault(v => v.Status == StartingConfigurationVersionStatus.Current);

    public static PlatformObjectiveBaseline Create()
        => new() { Id = Guid.NewGuid() };

    public PlatformObjectiveBaselineVersion Apply(
        int maxObjectives,
        string allowedWeightValues,
        string measurementTypes)
    {
        if (CurrentVersion is { } current)
            current.Replace();

        var nextNumber = _versions.Count == 0 ? 1 : _versions.Max(v => v.VersionNumber) + 1;

        var version = PlatformObjectiveBaselineVersion.CreateApplied(
            Id, nextNumber, maxObjectives, allowedWeightValues, measurementTypes);

        _versions.Add(version);
        UpdatedAt = DateTime.UtcNow;
        return version;
    }
}
