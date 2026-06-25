using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Campaign-scoped approval delegation record (D-16 scope note).
/// Performance is the default owner of approval delegation; this entity models it here
/// rather than in Core or Identity (no enterprise-wide delegation capability found).
/// </summary>
public sealed class ApprovalDelegate : BaseEntity, ITenantEntity
{
    private ApprovalDelegate() { }

    public Guid TenantId { get; private set; }

    /// <summary>The campaign this delegation is scoped to.</summary>
    public Guid CycleId { get; private set; }

    public Guid DelegatorEmployeeId { get; private set; }
    public Guid DelegateEmployeeId { get; private set; }
    public DateTime ValidFrom { get; private set; }
    public DateTime? ValidUntil { get; private set; }
    public bool IsActive { get; private set; }

    public static ApprovalDelegate Create(
        Guid tenantId,
        Guid cycleId,
        Guid delegatorEmployeeId,
        Guid delegateEmployeeId,
        DateTime validFrom,
        DateTime? validUntil = null)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || delegatorEmployeeId == Guid.Empty || delegateEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, campaign, delegator, and delegate are required.");
        if (delegatorEmployeeId == delegateEmployeeId)
            throw new ArgumentException("A delegate cannot be the same person as the delegator.");

        var normalizedFrom = NormalizeUtc(validFrom, nameof(validFrom));
        DateTime? normalizedUntil = validUntil.HasValue ? NormalizeUtc(validUntil.Value, nameof(validUntil)) : null;

        if (normalizedUntil.HasValue && normalizedUntil.Value <= normalizedFrom)
            throw new ArgumentException("ValidUntil must be after ValidFrom.");

        return new ApprovalDelegate
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            DelegatorEmployeeId = delegatorEmployeeId,
            DelegateEmployeeId = delegateEmployeeId,
            ValidFrom = normalizedFrom,
            ValidUntil = normalizedUntil,
            IsActive = true,
        };
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
