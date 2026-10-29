namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Bounded bootstrap history vocabulary. Detailed permission changes stay in the
/// existing Identity access audit; this vocabulary explains only the bootstrap
/// outcome and deliberately has no requested/started/completed event graph.
/// </summary>
public enum TenantBootstrapAuditEventType
{
    TenantProvisioned = 0,
    InvitationDeliveryAttempted = 1,
    InvitationResent = 2,
    InvitationRevoked = 3,
    InvitationReplaced = 4,
    InvitationReissued = 5,
    ActivationRejected = 6,
    BootstrapCompleted = 7,
    TenantDeactivated = 8,
    TenantReactivated = 9,
    TenantProfileChanged = 10,
    TenantArchived = 11,

    /// <summary>A platform administrator turned an optional product on; the reason names it.</summary>
    ProductEnabled = 12,

    /// <summary>A platform administrator turned an optional product off (paused, data kept); the reason names it.</summary>
    ProductDisabled = 13,
}
