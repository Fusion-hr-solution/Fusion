using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// Platform-owned source of truth for one module enabled for one tenant.
/// The shell reads entitlements for visibility; each protected Core HR and
/// Performance backend enforces them at its own authorization boundary.
/// </summary>
public class TenantModuleEntitlement : ITenantEntity
{
    private TenantModuleEntitlement() { } // EF constructor

    public Guid Id { get; private set; }

    public Guid TenantId { get; private set; }

    public TenantModule Module { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public Tenant? Tenant { get; private set; }

    public static TenantModuleEntitlement Create(Guid tenantId, TenantModule module, DateTime? createdAt = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

        return new TenantModuleEntitlement
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Module = module,
            CreatedAt = createdAt ?? DateTime.UtcNow,
        };
    }
}
