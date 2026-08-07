namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// How a Tenant Administrator assignment came to exist. Recorded because the
/// origin of authority is itself security-relevant history: an authority created
/// by Platform recovery is not the same fact as one granted by an existing
/// administrator.
/// </summary>
public enum TenantAdministratorGrantActor
{
    /// <summary>Granted by an existing Tenant Administrator.</summary>
    TenantAdministrator = 0,

    /// <summary>Established by the tenant's initial bootstrap activation.</summary>
    BootstrapActivation = 1,

    /// <summary>Established by accepting an administrative invitation.</summary>
    InvitationAcceptance = 2,

    /// <summary>Established by accepting a Platform recovery invitation.</summary>
    PlatformRecovery = 3,

    /// <summary>Converted from a pre-canonical assignment by migration.</summary>
    Migration = 4,
}
