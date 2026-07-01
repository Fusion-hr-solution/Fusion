using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// A standalone period-versioned strategic objective (D-01, D-02, D-03).
/// NOT bound to a PerformanceCycle. Scoped to tenant + organizational scope + period.
/// Published versions are immutable; republishing creates a new version and supersedes the prior.
/// </summary>
public sealed class StrategicObjective : AggregateRoot, ITenantEntity
{
    private StrategicObjective() { }

    public Guid TenantId { get; private set; }
    public uint Version { get; private set; }
    public Guid PeriodId { get; private set; }

    /// <summary>"Company" for company-wide scope, or an org-unit code for division/function/etc.</summary>
    public string OrgScope { get; private set; } = string.Empty;

    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public StrategicObjectiveStatus Status { get; private set; }

    /// <summary>Monotonically increasing within the same tenant + OrgScope + PeriodId.</summary>
    public int VersionNumber { get; private set; }

    /// <summary>Set when a newer published version supersedes this one (D-03).</summary>
    public Guid? SupersededById { get; private set; }

    public DateTime? PublishedAt { get; private set; }

    public static StrategicObjective Create(
        Guid tenantId,
        Guid periodId,
        string orgScope,
        string title,
        string? description)
    {
        if (tenantId == Guid.Empty || periodId == Guid.Empty)
            throw new ArgumentException("Tenant and period are required.");
        if (string.IsNullOrWhiteSpace(orgScope))
            throw new ArgumentException("Org scope is required.", nameof(orgScope));
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("SMART objectives require title.", nameof(title));

        return new StrategicObjective
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            PeriodId = periodId,
            OrgScope = orgScope.Trim()[..Math.Min(orgScope.Trim().Length, 100)],
            Title = title.Trim()[..Math.Min(title.Trim().Length, 200)],
            Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim(),
            Status = StrategicObjectiveStatus.Draft,
            VersionNumber = 1,
        };
    }

    /// <summary>
    /// Publishes this draft objective. Only Draft → Published is allowed (D-03).
    /// </summary>
    public void Publish(DateTime occurredAt)
    {
        if (Status != StrategicObjectiveStatus.Draft)
            throw new DomainRuleViolationException("Only a draft strategic objective can be published.");
        Status = StrategicObjectiveStatus.Published;
        PublishedAt = NormalizeUtc(occurredAt, nameof(occurredAt));
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Supersedes this published objective with a newer version (D-03).
    /// Only Published → Superseded is allowed; frozen history is never rewritten (D-04).
    /// </summary>
    public void Supersede(Guid replacedById, DateTime occurredAt)
    {
        if (Status != StrategicObjectiveStatus.Published)
            throw new DomainRuleViolationException("Only a published strategic objective can be superseded.");
        Status = StrategicObjectiveStatus.Superseded;
        SupersededById = replacedById;
        UpdatedAt = NormalizeUtc(occurredAt, nameof(occurredAt));
    }

    /// <summary>Advances the monotonic version counter when a new published version takes over.</summary>
    internal void SetVersionNumber(int versionNumber)
    {
        if (versionNumber < 1)
            throw new ArgumentOutOfRangeException(nameof(versionNumber), "Version number must be at least 1.");
        VersionNumber = versionNumber;
    }

    private static DateTime NormalizeUtc(DateTime value, string parameterName)
    {
        if (value == default) throw new ArgumentException("A valid date is required.", parameterName);
        return value.Kind switch
        {
            DateTimeKind.Utc => value,
            DateTimeKind.Local => value.ToUniversalTime(),
            _ => DateTime.SpecifyKind(value, DateTimeKind.Utc),
        };
    }
}
