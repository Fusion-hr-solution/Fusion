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

    /// <summary>
    /// Row version for optimistic concurrency control (mapped to PostgreSQL xmin).
    /// The maintenance drawer echoes it back as If-Match, so a command acting on a
    /// stale view of this administrator is refused rather than silently applied.
    /// </summary>
    public uint Version { get; private set; }

    /// <summary>
    /// Revision of this membership's tenant access. Every command that invalidates
    /// the current tenant session increments it inside the same transaction, and an
    /// access token carrying an older revision stops being honoured on the very
    /// next request.
    /// </summary>
    public int AccessRevision { get; private set; }

    public DateTime CreatedAt { get; private set; }

    public DateTime? SuspendedAt { get; private set; }

    public Guid? SuspendedByUserId { get; private set; }

    public string? SuspensionReason { get; private set; }

    public DateTime? ReactivatedAt { get; private set; }

    public Guid? ReactivatedByUserId { get; private set; }

    public ApplicationUser? User { get; private set; }

    public Tenant? Tenant { get; private set; }

    public List<UserAccessProfile> AccessProfileAssignments { get; private set; } = [];

    public List<TenantAdministratorAssignment> AdministratorAssignments { get; private set; } = [];

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

        var timestamp = createdAt ?? DateTime.UtcNow;

        return new TenantMembership
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            TenantId = tenantId,
            Status = status,
            AccessRevision = 1,
            CreatedAt = timestamp,
            SuspendedAt = status == TenantMembershipStatus.Suspended ? timestamp : null,
        };
    }

    /// <summary>
    /// Blocks tenant access while preserving the account, this membership, its
    /// access assignments, its Tenant Administrator authority, and its history.
    /// Reached only through the tenant continuity command boundary, which is what
    /// guarantees the tenant is not left without a usable administrator.
    /// </summary>
    public void Suspend(Guid? actorUserId, string? reason = null, DateTime? suspendedAt = null)
    {
        if (Status == TenantMembershipStatus.Suspended)
        {
            throw new InvalidOperationException("Membership is already suspended.");
        }

        Status = TenantMembershipStatus.Suspended;
        SuspendedAt = suspendedAt ?? DateTime.UtcNow;
        SuspendedByUserId = actorUserId;
        SuspensionReason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
        ReactivatedAt = null;
        ReactivatedByUserId = null;
    }

    /// <summary>
    /// Restores tenant access from the authority this membership already holds.
    /// It creates no account, membership, or assignment.
    /// </summary>
    public void Reactivate(Guid? actorUserId, DateTime? reactivatedAt = null)
    {
        if (Status == TenantMembershipStatus.Active)
        {
            throw new InvalidOperationException("Membership is already active.");
        }

        Status = TenantMembershipStatus.Active;
        ReactivatedAt = reactivatedAt ?? DateTime.UtcNow;
        ReactivatedByUserId = actorUserId;
        SuspensionReason = null;
    }

    /// <summary>
    /// Invalidates every access token currently carrying this membership's
    /// authority. Called inside the same transaction as the mutation that caused it.
    /// </summary>
    public void BumpAccessRevision() => AccessRevision++;
}
