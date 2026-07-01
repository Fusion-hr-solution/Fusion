using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public sealed class EmployeeOrgMembership : BaseEntity, ITenantEntity
{
    private EmployeeOrgMembership() { }

    public Guid TenantId { get; private set; }
    public Guid EmployeeId { get; private set; }
    public Guid OrgUnitId { get; private set; }
    public OrgMembershipType Type { get; private set; }
    public bool IsPrimary { get; private set; }
    public DateTime EffectiveFrom { get; private set; }
    public DateTime? EffectiveTo { get; private set; }

    public static EmployeeOrgMembership Create(
        Guid tenantId,
        Guid employeeId,
        Guid orgUnitId,
        OrgMembershipType type,
        bool isPrimary,
        DateTime effectiveFrom,
        DateTime? effectiveTo = null)
    {
        if (tenantId == Guid.Empty || employeeId == Guid.Empty || orgUnitId == Guid.Empty)
            throw new ArgumentException("Tenant, employee, and organization unit are required.");

        var from = Normalize(effectiveFrom);
        DateTime? to = effectiveTo.HasValue ? Normalize(effectiveTo.Value) : null;
        if (to.HasValue && to <= from)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveTo));

        return new EmployeeOrgMembership
        {
            Id = Guid.NewGuid(), TenantId = tenantId, EmployeeId = employeeId,
            OrgUnitId = orgUnitId, Type = type, IsPrimary = isPrimary,
            EffectiveFrom = from, EffectiveTo = to,
        };
    }

    public bool IsEffectiveOn(DateTime instant)
    {
        var at = Normalize(instant);
        return at >= EffectiveFrom && (!EffectiveTo.HasValue || at < EffectiveTo.Value);
    }

    private static DateTime Normalize(DateTime value) => value.Kind switch
    {
        DateTimeKind.Utc => value,
        DateTimeKind.Local => value.ToUniversalTime(),
        _ => throw new ArgumentException("Effective dates must be UTC or local time."),
    };
}
