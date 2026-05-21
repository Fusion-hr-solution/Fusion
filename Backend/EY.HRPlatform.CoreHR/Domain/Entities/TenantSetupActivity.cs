using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class TenantSetupActivity : BaseEntity, ITenantEntity
{
    private TenantSetupActivity() { }

    public Guid TenantId { get; private set; }

    public Guid TenantSetupStateId { get; private set; }

    public TenantSetupActivityType ActivityType { get; private set; }

    public Guid ActorUserId { get; private set; }

    public string ActorFullName { get; private set; } = string.Empty;

    public string ActorRole { get; private set; } = string.Empty;

    public bool IsPlatformAssisted { get; private set; }

    public TenantSetupState TenantSetupState { get; private set; } = null!;

    public static TenantSetupActivity Create(
        Guid tenantId,
        Guid tenantSetupStateId,
        TenantSetupActivityType activityType,
        Guid actorUserId,
        string actorFullName,
        string actorRole,
        bool isPlatformAssisted)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));

        if (tenantSetupStateId == Guid.Empty)
            throw new ArgumentException("TenantSetupStateId cannot be empty.", nameof(tenantSetupStateId));

        if (actorUserId == Guid.Empty)
            throw new ArgumentException("ActorUserId cannot be empty.", nameof(actorUserId));

        if (string.IsNullOrWhiteSpace(actorFullName))
            throw new ArgumentException("ActorFullName cannot be empty.", nameof(actorFullName));

        if (string.IsNullOrWhiteSpace(actorRole))
            throw new ArgumentException("ActorRole cannot be empty.", nameof(actorRole));

        return new TenantSetupActivity
        {
            TenantId = tenantId,
            TenantSetupStateId = tenantSetupStateId,
            ActivityType = activityType,
            ActorUserId = actorUserId,
            ActorFullName = actorFullName.Trim(),
            ActorRole = actorRole.Trim(),
            IsPlatformAssisted = isPlatformAssisted,
        };
    }
}
