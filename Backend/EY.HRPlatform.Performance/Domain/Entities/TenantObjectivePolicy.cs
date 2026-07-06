using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Stable identity for a tenant's objective planning configuration.
/// Unique per tenant. Versions hold the immutable applied configuration.
/// </summary>
public class TenantObjectivePolicy : BaseEntity, ITenantEntity
{
    private readonly List<TenantObjectivePolicyVersion> _versions = [];

    private TenantObjectivePolicy() { }

    public Guid TenantId { get; private set; }

    public IReadOnlyList<TenantObjectivePolicyVersion> Versions => _versions.AsReadOnly();

    public TenantObjectivePolicyVersion? ActiveVersion
        => _versions.SingleOrDefault(v => v.Status == ObjectivePlanningConfigurationVersionStatus.Current);

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

    public TenantObjectivePolicyVersion ApplyConfiguration(
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        string measurementTypes,
        Guid appliedByUserId,
        string? appliedByName,
        string? changeSummary,
        Guid? sourceStartingConfigurationVersionId = null)
    {
        var nextNumber = _versions.Count == 0 ? 1 : _versions.Max(v => v.VersionNumber) + 1;
        var sourceVersionId = ActiveVersion?.Id;
        ActiveVersion?.Replace();

        var applied = TenantObjectivePolicyVersion.CreateApplied(
            TenantId, Id, nextNumber,
            maxObjectivesPerPlan, allowedWeightValues, measurementTypes,
            appliedByUserId, appliedByName, changeSummary,
            sourceVersionId, sourceStartingConfigurationVersionId);

        _versions.Add(applied);
        UpdatedAt = DateTime.UtcNow;
        return applied;
    }

    /// <summary>
    /// Provision the first current planning configuration from the platform starting configuration.
    /// Used only during tenant provisioning.
    /// </summary>
    public TenantObjectivePolicyVersion ProvisionFromStartingConfiguration(
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        string measurementTypes,
        Guid sourceStartingConfigurationVersionId)
    {
        if (_versions.Count > 0)
            throw new DomainRuleViolationException("Cannot provision a planning configuration that already has versions.");

        var version = TenantObjectivePolicyVersion.CreateApplied(
            TenantId, Id, 1,
            maxObjectivesPerPlan, allowedWeightValues, measurementTypes,
            TenantId, null, "Provisioned from platform starting configuration",
            null, sourceStartingConfigurationVersionId);

        _versions.Add(version);
        UpdatedAt = DateTime.UtcNow;
        return version;
    }
}
