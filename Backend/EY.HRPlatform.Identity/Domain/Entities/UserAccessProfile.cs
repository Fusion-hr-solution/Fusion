using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// A tenant access assignment. The assignment stays tenant-scoped for efficient
/// authorization and tenant-safe foreign keys, but its account authority is the
/// referenced membership: a composite foreign key makes it impossible to store an
/// assignment whose account/tenant pair disagrees with its membership.
/// </summary>
public class UserAccessProfile : ITenantEntity
{
    private UserAccessProfile() { }

    public Guid TenantId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid AccessProfileId { get; private set; }

    /// <summary>Membership that authorizes this assignment.</summary>
    public Guid TenantMembershipId { get; private set; }

    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public ApplicationUser? User { get; private set; }
    public AccessProfile? AccessProfile { get; private set; }
    public TenantMembership? TenantMembership { get; private set; }

    public static UserAccessProfile Create(
        Guid tenantId,
        Guid userId,
        Guid accessProfileId,
        Guid tenantMembershipId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));

        if (userId == Guid.Empty)
            throw new ArgumentException("UserId is required.", nameof(userId));

        if (accessProfileId == Guid.Empty)
            throw new ArgumentException("AccessProfileId is required.", nameof(accessProfileId));

        if (tenantMembershipId == Guid.Empty)
            throw new ArgumentException("TenantMembershipId is required.", nameof(tenantMembershipId));

        return new UserAccessProfile
        {
            TenantId = tenantId,
            UserId = userId,
            AccessProfileId = accessProfileId,
            TenantMembershipId = tenantMembershipId,
        };
    }

    /// <summary>
    /// Creates an assignment from its authorizing membership, which guarantees the
    /// account and tenant match the membership.
    /// </summary>
    public static UserAccessProfile ForMembership(TenantMembership membership, Guid accessProfileId)
    {
        ArgumentNullException.ThrowIfNull(membership);

        return Create(membership.TenantId, membership.UserId, accessProfileId, membership.Id);
    }
}
