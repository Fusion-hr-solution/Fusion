using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Tracks the onboarding setup progress of a tenant within the CoreHR service.
/// One row per tenant, created on first authenticated access.
/// </summary>
public class TenantSetupState : BaseEntity, ITenantEntity
{
    private TenantSetupState() { }

    public Guid TenantId { get; private set; }

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// </summary>
    public uint Version { get; private set; }

    /// <summary>
    /// Current overall setup status, derived from the two milestone flags.
    /// </summary>
    public SetupStatus Status { get; private set; }

    /// <summary>
    /// True once at least one OrgUnit has been created and the structure is considered ready.
    /// </summary>
    public bool OrgUnitsConfigured { get; private set; }

    /// <summary>
    /// True once at least one employee has been imported or created.
    /// </summary>
    public bool EmployeesImported { get; private set; }

    public static TenantSetupState Create(Guid tenantId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        return new TenantSetupState
        {
            TenantId = tenantId,
            Status = SetupStatus.NotStarted,
            OrgUnitsConfigured = false,
            EmployeesImported = false
        };
    }

    public void MarkOrgUnitsConfigured()
    {
        OrgUnitsConfigured = true;
        RecalculateStatus();
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkEmployeesImported()
    {
        EmployeesImported = true;
        RecalculateStatus();
        UpdatedAt = DateTime.UtcNow;
    }

    private void RecalculateStatus()
    {
        Status = (OrgUnitsConfigured, EmployeesImported) switch
        {
            (true, true) => SetupStatus.Operational,
            (false, false) => SetupStatus.NotStarted,
            _ => SetupStatus.InProgress
        };
    }
}
