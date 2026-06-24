using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

public class UserAccessProfile : ITenantEntity
{
    private UserAccessProfile() { }

    public Guid TenantId { get; private set; }
    public Guid UserId { get; private set; }
    public Guid AccessProfileId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public ApplicationUser? User { get; private set; }
    public AccessProfile? AccessProfile { get; private set; }

    public static UserAccessProfile Create(Guid tenantId, Guid userId, Guid accessProfileId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));

        if (userId == Guid.Empty)
            throw new ArgumentException("UserId is required.", nameof(userId));

        if (accessProfileId == Guid.Empty)
            throw new ArgumentException("AccessProfileId is required.", nameof(accessProfileId));

        return new UserAccessProfile
        {
            TenantId = tenantId,
            UserId = userId,
            AccessProfileId = accessProfileId,
        };
    }
}
