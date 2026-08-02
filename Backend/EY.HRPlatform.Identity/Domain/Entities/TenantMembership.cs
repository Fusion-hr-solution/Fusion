using EY.HRPlatform.Identity.Domain.Enums;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// The relationship between a global Identity Account and one customer tenant.
/// This is the only authority for customer-workspace tenancy: an account row no
/// longer carries tenant ownership, and a Core HR Employee is never inferred from
/// a membership.
/// </summary>
public class TenantMembership : ITenantEntity
{
    private TenantMembership() { } // EF constructor

    public Guid Id { get; private set; }

    /// <summary>Account participating in the tenant.</summary>
    public Guid UserId { get; private set; }

    /// <summary>Tenant the account participates in.</summary>
    public Guid TenantId { get; private set; }

    public TenantMembershipStatus Status { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime? DeactivatedAt { get; private set; }

    public ApplicationUser? User { get; private set; }

    public Tenant? Tenant { get; private set; }

    public List<UserAccessProfile> AccessProfileAssignments { get; private set; } = [];

    public bool IsActive => Status == TenantMembershipStatus.Active;

    public static TenantMembership Create(
        Guid userId,
        Guid tenantId,
        TenantMembershipStatus status = TenantMembershipStatus.Active,
        DateTime? createdAt = null)
    {
        if (userId == Guid.Empty)
            throw new ArgumentException("User ID is required.", nameof(userId));

        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

        return new TenantMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TenantId = tenantId,
            Status = status,
            CreatedAt = createdAt ?? DateTime.UtcNow,
            DeactivatedAt = status == TenantMembershipStatus.Inactive
                ? createdAt ?? DateTime.UtcNow
                : null,
        };
    }

    /// <summary>
    /// Ends the customer relationship. Deactivation is the supported lifecycle
    /// operation; the row is retained so access and audit history survive.
    /// </summary>
    public void Deactivate()
    {
        if (Status == TenantMembershipStatus.Inactive)
            throw new InvalidOperationException("Membership is already inactive.");

        Status = TenantMembershipStatus.Inactive;
        DeactivatedAt = DateTime.UtcNow;
    }
}
