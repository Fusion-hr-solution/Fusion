using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Common;

/// <summary>
/// Base for every Performance aggregate root. Carries the tenant identity that the
/// fail-closed query filter and the save-changes interceptor enforce, so no Performance
/// record can be read or written outside its tenant.
/// </summary>
public abstract class PerformanceAggregate : AggregateRoot, ITenantEntity
{
    public Guid TenantId { get; protected set; }

    protected void MarkUpdated() => UpdatedAt = DateTime.UtcNow;
}

/// <summary>
/// Base for tenant-scoped child entities that live in their own table but belong to an
/// aggregate (participants, milestones). They are tenant-scoped for the same fail-closed
/// guarantees without being independent roots.
/// </summary>
public abstract class PerformanceChildEntity : BaseEntity, ITenantEntity
{
    public Guid TenantId { get; protected set; }

    protected void MarkUpdated() => UpdatedAt = DateTime.UtcNow;
}
