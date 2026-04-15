using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class TenantSetupState : BaseEntity, ITenantEntity
{
    private TenantSetupState() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }

    public TenantSetupPhase CurrentPhase { get; private set; }

    public DateTime? ActivatedAt { get; private set; }

    public DateTime? StructurallyGovernedAt { get; private set; }

    public DateTime? StructurallyPublishedAt { get; private set; }

    public DateTime? OperationalAt { get; private set; }

    public static TenantSetupState CreateActivated(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        return new TenantSetupState
        {
            TenantId = tenantId,
            CurrentPhase = TenantSetupPhase.Activated,
            ActivatedAt = DateTime.UtcNow
        };
    }

    public void EnsureActivated()
    {
        if (CurrentPhase != TenantSetupPhase.NotStarted)
            return;

        CurrentPhase = TenantSetupPhase.Activated;
        ActivatedAt ??= DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }
}