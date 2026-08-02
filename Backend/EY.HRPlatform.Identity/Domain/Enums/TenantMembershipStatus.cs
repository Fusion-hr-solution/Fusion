namespace EY.HRPlatform.Identity.Domain.Enums;

/// <summary>
/// Status of an account's participation in a customer tenant.
/// Ending a customer relationship transitions to Inactive; memberships are never
/// deleted at runtime so access and audit history stay referentially valid.
/// </summary>
public enum TenantMembershipStatus
{
    Active = 0,
    Inactive = 1,
}
