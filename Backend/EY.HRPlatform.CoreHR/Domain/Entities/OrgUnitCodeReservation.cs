using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public sealed class OrgUnitCodeReservation : BaseEntity, ITenantEntity
{
    private OrgUnitCodeReservation() { }

    public Guid TenantId { get; private set; }
    public Guid OrgUnitId { get; private set; }
    public OrgUnit OrgUnit { get; private set; } = null!;
    public string NormalizedCode { get; private set; } = string.Empty;

    public static OrgUnitCodeReservation Create(Guid tenantId, Guid orgUnitId, string code)
    {
        if (tenantId == Guid.Empty || orgUnitId == Guid.Empty || string.IsNullOrWhiteSpace(code))
            throw new ArgumentException("Tenant, Organizational Unit, and code are required.");

        return new OrgUnitCodeReservation
        {
            TenantId = tenantId,
            OrgUnitId = orgUnitId,
            NormalizedCode = code.Trim().ToUpperInvariant(),
        };
    }
}
