using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public enum ObjectivePlanningConfigurationVersionStatus { Current, Replaced }

public class TenantObjectivePolicyVersion : BaseEntity, ITenantEntity
{
    private TenantObjectivePolicyVersion() { }

    public Guid TenantId { get; private set; }
    public Guid PolicyId { get; private set; }
    public int VersionNumber { get; private set; }
    public ObjectivePlanningConfigurationVersionStatus Status { get; private set; }

    public int MaxObjectivesPerPlan { get; private set; }

    /// <summary>JSON array of allowed weight percentages, e.g. "[25,50,75,100]".</summary>
    public string AllowedWeightValues { get; private set; } = string.Empty;

    /// <summary>Comma-separated: Quantitative, Qualitative, or both.</summary>
    public string MeasurementTypes { get; private set; } = string.Empty;

    /// <summary>Row version for optimistic concurrency (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public Guid? SourceVersionId { get; private set; }
    public Guid? SourceStartingConfigurationVersionId { get; private set; }

    public Guid CreatedByUserId { get; private set; }
    public string? CreatedByName { get; private set; }
    public DateTime? AppliedAt { get; private set; }
    public Guid? AppliedByUserId { get; private set; }
    public string? AppliedByName { get; private set; }
    public string? ChangeSummary { get; private set; }
    public DateTime? ReplacedAt { get; private set; }

    internal static TenantObjectivePolicyVersion CreateApplied(
        Guid tenantId,
        Guid policyId,
        int versionNumber,
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        string measurementTypes,
        Guid appliedByUserId,
        string? appliedByName,
        string? changeSummary,
        Guid? sourceVersionId = null,
        Guid? sourceStartingConfigurationVersionId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (policyId == Guid.Empty)
            throw new ArgumentException("PolicyId cannot be empty.", nameof(policyId));
        if (maxObjectivesPerPlan < 1)
            throw new ArgumentException("MaxObjectivesPerPlan must be at least 1.", nameof(maxObjectivesPerPlan));
        if (string.IsNullOrWhiteSpace(allowedWeightValues))
            throw new ArgumentException("AllowedWeightValues cannot be empty.", nameof(allowedWeightValues));
        if (string.IsNullOrWhiteSpace(measurementTypes))
            throw new ArgumentException("MeasurementTypes cannot be empty.", nameof(measurementTypes));

        return new TenantObjectivePolicyVersion
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PolicyId = policyId,
            VersionNumber = versionNumber,
            Status = ObjectivePlanningConfigurationVersionStatus.Current,
            MaxObjectivesPerPlan = maxObjectivesPerPlan,
            AllowedWeightValues = allowedWeightValues.Trim(),
            MeasurementTypes = measurementTypes.Trim(),
            CreatedByUserId = appliedByUserId,
            CreatedByName = appliedByName,
            AppliedAt = DateTime.UtcNow,
            AppliedByUserId = appliedByUserId,
            AppliedByName = appliedByName,
            ChangeSummary = changeSummary,
            SourceVersionId = sourceVersionId,
            SourceStartingConfigurationVersionId = sourceStartingConfigurationVersionId,
        };
    }

    internal void Replace()
    {
        if (Status != ObjectivePlanningConfigurationVersionStatus.Current)
            throw new DomainRuleViolationException("Only a current objective planning configuration can be replaced.");

        Status = ObjectivePlanningConfigurationVersionStatus.Replaced;
        ReplacedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    internal bool HasSamePlanningValues(
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        string measurementTypes)
        => MaxObjectivesPerPlan == maxObjectivesPerPlan
            && string.Equals(AllowedWeightValues, allowedWeightValues.Trim(), StringComparison.Ordinal)
            && string.Equals(MeasurementTypes, measurementTypes.Trim(), StringComparison.Ordinal);
}
