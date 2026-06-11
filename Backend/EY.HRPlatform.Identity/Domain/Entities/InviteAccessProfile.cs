using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

public class InviteAccessProfile : ITenantEntity
{
    private InviteAccessProfile() { }

    public Guid TenantId { get; private set; }
    public Guid InviteTokenId { get; private set; }
    public Guid AccessProfileId { get; private set; }
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;

    public InviteToken? InviteToken { get; private set; }
    public AccessProfile? AccessProfile { get; private set; }

    public static InviteAccessProfile Create(Guid tenantId, Guid inviteTokenId, Guid accessProfileId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));

        if (inviteTokenId == Guid.Empty)
            throw new ArgumentException("InviteTokenId is required.", nameof(inviteTokenId));

        if (accessProfileId == Guid.Empty)
            throw new ArgumentException("AccessProfileId is required.", nameof(accessProfileId));

        return new InviteAccessProfile
        {
            TenantId = tenantId,
            InviteTokenId = inviteTokenId,
            AccessProfileId = accessProfileId,
        };
    }
}
