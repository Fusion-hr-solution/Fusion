using EY.HRPlatform.Performance.Exceptions;
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

    public PlatformObjectiveBaselineVersion? ActiveDraft
        => _versions.SingleOrDefault(v => v.Status == BaselineVersionStatus.Draft);

    public PlatformObjectiveBaselineVersion? PublishedVersion
        => _versions.SingleOrDefault(v => v.Status == BaselineVersionStatus.Published);

    public static PlatformObjectiveBaseline Create()
        => new() { Id = Guid.NewGuid() };

    public PlatformObjectiveBaselineVersion CreateDraft(
        int maxObjectives,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled)
    {
        if (ActiveDraft is not null)
            throw new DomainRuleViolationException(
                "A Draft baseline version already exists. Discard or publish it before creating a new one.");

        var nextNumber = _versions.Count == 0 ? 1 : _versions.Max(v => v.VersionNumber) + 1;

        var draft = PlatformObjectiveBaselineVersion.Create(
            Id, nextNumber, maxObjectives, allowedWeightValues,
            managerValidationSlaDays, cascadeMode, measurementTypes, attachmentsEnabled);

        _versions.Add(draft);
        UpdatedAt = DateTime.UtcNow;
        return draft;
    }

    public void PublishDraft()
    {
        var draft = ActiveDraft
            ?? throw new DomainRuleViolationException("No Draft version to publish.");

        if (PublishedVersion is { } current)
            current.Supersede();

        draft.Publish();
        UpdatedAt = DateTime.UtcNow;
    }
}
