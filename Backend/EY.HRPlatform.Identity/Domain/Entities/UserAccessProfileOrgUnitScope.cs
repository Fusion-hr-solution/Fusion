using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// An explicit organizational boundary attached to a user's access-profile assignment.
/// The absence of a scope row means that assignment is tenant-wide; rows restrict it to
/// the listed Core organization units.
/// </summary>
public sealed class UserAccessProfileOrgUnitScope : ITenantEntity
{
    private UserAccessProfileOrgUnitScope() { }

    public Guid TenantId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid AccessProfileId { get; private set; }
    public Guid OrgUnitId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public static UserAccessProfileOrgUnitScope Create(
        Guid tenantId,
        Guid userId,
        Guid accessProfileId,
        Guid orgUnitId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (userId == Guid.Empty)
            throw new ArgumentException("UserId is required.", nameof(userId));
        if (accessProfileId == Guid.Empty)
            throw new ArgumentException("AccessProfileId is required.", nameof(accessProfileId));
        if (orgUnitId == Guid.Empty)
            throw new ArgumentException("OrgUnitId is required.", nameof(orgUnitId));

        return new UserAccessProfileOrgUnitScope
        {
            TenantId = tenantId,
            UserId = userId,
            AccessProfileId = accessProfileId,
            OrgUnitId = orgUnitId,
        };
    }
}
