using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

public enum PolicyVersionStatus { Active, Superseded }

public class TenantObjectivePolicyVersion : BaseEntity, ITenantEntity
{
    private TenantObjectivePolicyVersion() { }

    public Guid TenantId { get; private set; }
    public Guid PolicyId { get; private set; }
    public int VersionNumber { get; private set; }
    public PolicyVersionStatus Status { get; private set; }

    public int MaxObjectivesPerPlan { get; private set; }

    /// <summary>JSON array of allowed weight percentages, e.g. "[25,50,75,100]".</summary>
    public string AllowedWeightValues { get; private set; } = string.Empty;

    public int ManagerValidationSlaDays { get; private set; }

    /// <summary>Disabled | Optional | Required.</summary>
    public string CascadeMode { get; private set; } = string.Empty;

    /// <summary>Comma-separated: Quantitative, Qualitative, or both.</summary>
    public string MeasurementTypes { get; private set; } = string.Empty;

    public bool AttachmentsEnabled { get; private set; }

    /// <summary>Row version for optimistic concurrency (mapped to PostgreSQL xmin).</summary>
    public uint Version { get; private set; }

    public Guid? SourceVersionId { get; private set; }
    public Guid? SourceBaselineVersionId { get; private set; }

    public Guid CreatedByUserId { get; private set; }
    public string? CreatedByName { get; private set; }
    public DateTime? ActivatedAt { get; private set; }
    public Guid? ActivatedByUserId { get; private set; }
    public string? ActivatedByName { get; private set; }
    public string? ChangeSummary { get; private set; }
    public DateTime? SupersededAt { get; private set; }

    internal static TenantObjectivePolicyVersion CreateApplied(
        Guid tenantId,
        Guid policyId,
        int versionNumber,
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled,
        Guid appliedByUserId,
        string? appliedByName,
        string? changeSummary,
        Guid? sourceVersionId = null,
        Guid? sourceBaselineVersionId = null)
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
            Status = PolicyVersionStatus.Active,
            MaxObjectivesPerPlan = maxObjectivesPerPlan,
            AllowedWeightValues = allowedWeightValues.Trim(),
            ManagerValidationSlaDays = managerValidationSlaDays,
            CascadeMode = cascadeMode.Trim(),
            MeasurementTypes = measurementTypes.Trim(),
            AttachmentsEnabled = attachmentsEnabled,
            CreatedByUserId = appliedByUserId,
            CreatedByName = appliedByName,
            ActivatedAt = DateTime.UtcNow,
            ActivatedByUserId = appliedByUserId,
            ActivatedByName = appliedByName,
            ChangeSummary = changeSummary,
            SourceVersionId = sourceVersionId,
            SourceBaselineVersionId = sourceBaselineVersionId,
        };
    }

    internal void Supersede()
    {
        if (Status != PolicyVersionStatus.Active)
            throw new DomainRuleViolationException("Only an Active version can be superseded.");

        Status = PolicyVersionStatus.Superseded;
        SupersededAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    internal bool HasSamePolicyValues(
        int maxObjectivesPerPlan,
        string allowedWeightValues,
        int managerValidationSlaDays,
        string cascadeMode,
        string measurementTypes,
        bool attachmentsEnabled)
        => MaxObjectivesPerPlan == maxObjectivesPerPlan
            && string.Equals(AllowedWeightValues, allowedWeightValues.Trim(), StringComparison.Ordinal)
            && ManagerValidationSlaDays == managerValidationSlaDays
            && string.Equals(CascadeMode, cascadeMode.Trim(), StringComparison.Ordinal)
            && string.Equals(MeasurementTypes, measurementTypes.Trim(), StringComparison.Ordinal)
            && AttachmentsEnabled == attachmentsEnabled;
}
