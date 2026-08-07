using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Identity.Domain.Entities;

public class AccessAuditEvent : BaseEntity, ITenantEntity
{
    /// <summary>
    /// Stored when a command supplied no actor name. Most commands hold a user id
    /// rather than an account, so this is the normal stored value and readers
    /// resolve the person from <see cref="ActorUserId"/> instead of printing it.
    /// </summary>
    public const string UnresolvedActor = "Unknown";

    private AccessAuditEvent() { }

    public Guid TenantId { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public string ActorRole { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string ResourceType { get; private set; } = string.Empty;
    public string? ResourceId { get; private set; }
    public string Summary { get; private set; } = string.Empty;
    public string? BeforeJson { get; private set; }
    public string? AfterJson { get; private set; }
    public string? CorrelationId { get; private set; }

    public static AccessAuditEvent Create(
        Guid tenantId,
        Guid? actorUserId,
        string actorName,
        string actorRole,
        string action,
        string resourceType,
        string? resourceId,
        string summary,
        string? beforeJson,
        string? afterJson,
        string? correlationId)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(action))
            throw new ArgumentException("Action is required.", nameof(action));
        if (string.IsNullOrWhiteSpace(resourceType))
            throw new ArgumentException("ResourceType is required.", nameof(resourceType));
        if (string.IsNullOrWhiteSpace(summary))
            throw new ArgumentException("Summary is required.", nameof(summary));

        return new AccessAuditEvent
        {
            TenantId = tenantId,
            OccurredAt = DateTime.UtcNow,
            ActorUserId = actorUserId,
            ActorName = string.IsNullOrWhiteSpace(actorName) ? UnresolvedActor : actorName.Trim(),
            ActorRole = string.IsNullOrWhiteSpace(actorRole) ? UnresolvedActor : actorRole.Trim(),
            Action = action.Trim(),
            ResourceType = resourceType.Trim(),
            ResourceId = string.IsNullOrWhiteSpace(resourceId) ? null : resourceId.Trim(),
            Summary = summary.Trim(),
            BeforeJson = beforeJson,
            AfterJson = afterJson,
            CorrelationId = string.IsNullOrWhiteSpace(correlationId) ? null : correlationId.Trim(),
        };
    }
}
