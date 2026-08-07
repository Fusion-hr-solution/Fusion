namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Explicit purpose of an invitation. Purpose is bound at creation and is never
/// inferred from the assigned role, so a bootstrap invitation can never be
/// activated through the workforce route and vice versa.
/// </summary>
public enum InvitationPurpose
{
    /// <summary>Existing Core workforce-account invitation. Business behavior unchanged.</summary>
    WorkforceAccount = 0,

    /// <summary>Initial Tenant Administrator bootstrap invitation issued by Platform provisioning.</summary>
    OrganizationBootstrap = 1,

    /// <summary>
    /// An additional Tenant Administrator invited by an existing Tenant
    /// Administrator, inside a tenant that is already active.
    /// </summary>
    TenantAdministrator = 2,

    /// <summary>
    /// Platform-assisted recovery of customer-controlled administration, issued by
    /// a Platform Administrator only while the tenant has no usable administrator.
    /// <para>
    /// Separate from <see cref="TenantAdministrator"/> rather than a flag on it:
    /// the two differ in who may issue them, what must be true before issuing,
    /// what the recipient is told, and how the event is audited. A shared value
    /// with a discriminator would make every one of those checks read a field the
    /// type could have carried.
    /// </para>
    /// </summary>
    TenantAdministratorRecovery = 3,
}

public static class InvitationPurposes
{
    /// <summary>
    /// Purposes that use the hash-only selector/digest credential rather than the
    /// legacy raw token. A raw reusable secret is never persisted for these.
    /// </summary>
    public static readonly IReadOnlyList<InvitationPurpose> CredentialBearing =
    [
        InvitationPurpose.OrganizationBootstrap,
        InvitationPurpose.TenantAdministrator,
        InvitationPurpose.TenantAdministratorRecovery,
    ];

    /// <summary>
    /// Purposes that establish Tenant Administrator authority. These may never be
    /// issued or accepted through a workforce route.
    /// </summary>
    public static readonly IReadOnlyList<InvitationPurpose> Administrative =
    [
        InvitationPurpose.TenantAdministrator,
        InvitationPurpose.TenantAdministratorRecovery,
    ];

    public static bool IsCredentialBearing(InvitationPurpose purpose)
        => CredentialBearing.Contains(purpose);

    public static bool IsAdministrative(InvitationPurpose purpose)
        => Administrative.Contains(purpose);
}
