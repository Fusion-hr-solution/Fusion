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
}
