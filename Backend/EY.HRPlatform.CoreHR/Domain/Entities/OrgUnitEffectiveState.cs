using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public enum OrgUnitLifecycleState
{
    Active = 1,
    Inactive = 2,
}

/// <summary>
/// A complete calendar-date snapshot of an Organizational Unit's business state.
/// Intervals are half-open: [EffectiveFrom, EffectiveTo).
/// </summary>
public sealed class OrgUnitEffectiveState : BaseEntity, ITenantEntity
{
    private OrgUnitEffectiveState() { }

    public Guid TenantId { get; private set; }
    public Guid OrgUnitId { get; private set; }
    public OrgUnit OrgUnit { get; private set; } = null!;
    public Guid OrganizationalUnitTypeId { get; private set; }
    public OrganizationalUnitType OrganizationalUnitType { get; private set; } = null!;
    public Guid? ParentOrgUnitId { get; private set; }
    public OrgUnit? ParentOrgUnit { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public OrgUnitLifecycleState LifecycleState { get; private set; }
    public DateOnly EffectiveFrom { get; private set; }
    public DateOnly? EffectiveTo { get; private set; }

    public static OrgUnitEffectiveState Create(
        Guid tenantId,
        Guid orgUnitId,
        Guid organizationalUnitTypeId,
        Guid? parentOrgUnitId,
        string name,
        OrgUnitLifecycleState lifecycleState,
        DateOnly effectiveFrom,
        DateOnly? effectiveTo = null)
    {
        if (tenantId == Guid.Empty || orgUnitId == Guid.Empty || organizationalUnitTypeId == Guid.Empty)
            throw new ArgumentException("Tenant, Organizational Unit, and type are required.");

        if (string.IsNullOrWhiteSpace(name) || name.Trim().Length > 200)
            throw new ArgumentException("A name of at most 200 characters is required.", nameof(name));

        if (effectiveTo is not null && effectiveTo <= effectiveFrom)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveTo));

        return new OrgUnitEffectiveState
        {
            TenantId = tenantId,
            OrgUnitId = orgUnitId,
            OrganizationalUnitTypeId = organizationalUnitTypeId,
            ParentOrgUnitId = parentOrgUnitId,
            Name = name.Trim(),
            LifecycleState = lifecycleState,
            EffectiveFrom = effectiveFrom,
            EffectiveTo = effectiveTo,
        };
    }

    public void Replace(DateOnly effectiveTo, string name, Guid typeId, Guid? parentId, OrgUnitLifecycleState lifecycleState)
    {
        if (effectiveTo <= EffectiveFrom)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveTo));

        EffectiveTo = effectiveTo;
        Name = name.Trim();
        OrganizationalUnitTypeId = typeId;
        ParentOrgUnitId = parentId;
        LifecycleState = lifecycleState;
    }

    public void CloseAt(DateOnly effectiveDate)
    {
        if (effectiveDate <= EffectiveFrom)
            throw new ArgumentException("Effective end must be after effective start.", nameof(effectiveDate));

        EffectiveTo = effectiveDate;
    }
}
