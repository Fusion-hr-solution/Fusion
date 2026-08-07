namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Status of an account's participation in a customer tenant.
/// <para>
/// The transition is reversible in both directions. Suspension blocks tenant
/// access while preserving the account, the membership row, its access
/// assignments, its Tenant Administrator authority, and its history; memberships
/// are never deleted at runtime so access and audit history stay referentially
/// valid.
/// </para>
/// </summary>
public enum TenantMembershipStatus
{
    Active = 0,

    /// <summary>Tenant access blocked. Everything else is preserved.</summary>
    Suspended = 1,
}
