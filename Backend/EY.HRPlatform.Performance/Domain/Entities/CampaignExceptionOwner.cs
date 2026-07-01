using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An authorized campaign-level owner for unresolved workflow-routing exceptions.
/// This role owns resolving the exception; it is not an implicit business approver.
/// </summary>
public sealed class CampaignExceptionOwner : BaseEntity, ITenantEntity
{
    private CampaignExceptionOwner() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public int Priority { get; private set; }

    public static CampaignExceptionOwner Create(Guid tenantId, Guid cycleId, Guid employeeId, int priority)
    {
        if (tenantId == Guid.Empty || cycleId == Guid.Empty || employeeId == Guid.Empty)
            throw new ArgumentException("Tenant, campaign, and exception owner are required.");
        if (priority < 1)
            throw new ArgumentOutOfRangeException(nameof(priority));

        return new CampaignExceptionOwner
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            EmployeeId = employeeId,
            Priority = priority
        };
    }
}
