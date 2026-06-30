using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Stable identity for a tenant's objective policy.
/// Unique per tenant. Versions hold the immutable published content.
/// </summary>
public class TenantObjectivePolicy : BaseEntity, ITenantEntity
{
    private readonly List<TenantObjectivePolicyVersion> _versions = [];

    private TenantObjectivePolicy() { }

    public Guid TenantId { get; private set; }

    public IReadOnlyList<TenantObjectivePolicyVersion> Versions => _versions.AsReadOnly();

    public TenantObjectivePolicyVersion? Draft
        => _versions.SingleOrDefault(v => v.Status == PolicyVersionStatus.Draft);

    public TenantObjectivePolicyVersion? ActiveVersion
        => _versions.SingleOrDefault(v => v.Status == PolicyVersionStatus.Active);

    public static TenantObjectivePolicy Create(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        return new TenantObjectivePolicy
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
        };
    }

    public TenantObjectivePolicyVersion CreateDraft(
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled,
        Guid createdByUserId,
        string? createdByName,
        Guid? sourceBaselineVersionId = null)
    {
        if (Draft is not null)
            throw new DomainRuleViolationException(
                "A Draft version already exists. Discard or publish it before creating a new one.");

        var nextNumber = _versions.Count == 0 ? 1 : _versions.Max(v => v.VersionNumber) + 1;
        var sourceVersionId = ActiveVersion?.Id;

        var draft = TenantObjectivePolicyVersion.Create(
            TenantId, Id, nextNumber,
            maxObjectivesPerPlan, allowedWeightValues,
            managerValidationSlaDays, cascadeMode, measurementTypes, attachmentsEnabled,
            createdByUserId, createdByName,
            sourceVersionId, sourceBaselineVersionId);

        _versions.Add(draft);
        return draft;
    }

    public void PublishDraft(Guid publishedByUserId, string? publishedByName, string? changeSummary)
    {
        var draft = Draft
            ?? throw new DomainRuleViolationException("No Draft version to publish.");

        ActiveVersion?.Supersede();
        draft.Activate(publishedByUserId, publishedByName, changeSummary);
        UpdatedAt = DateTime.UtcNow;
    }

    public void DiscardDraft()
    {
        var draft = Draft
            ?? throw new DomainRuleViolationException("No Draft version to discard.");

        _versions.Remove(draft);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Provision an Active policy directly from a published baseline version.
    /// Used only during tenant provisioning — bypasses Draft/validate cycle.
    /// </summary>
    public TenantObjectivePolicyVersion ProvisionFromBaseline(
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled,
        Guid sourceBaselineVersionId)
    {
        if (_versions.Count > 0)
            throw new DomainRuleViolationException("Cannot provision a policy that already has versions.");

        var version = TenantObjectivePolicyVersion.Create(
            TenantId, Id, 1,
            maxObjectivesPerPlan, allowedWeightValues,
            managerValidationSlaDays, cascadeMode, measurementTypes, attachmentsEnabled,
            TenantId, null,
            null, sourceBaselineVersionId);

        version.Activate(TenantId, null, "Provisioned from platform baseline");
        _versions.Add(version);
        UpdatedAt = DateTime.UtcNow;
        return version;
    }
}
