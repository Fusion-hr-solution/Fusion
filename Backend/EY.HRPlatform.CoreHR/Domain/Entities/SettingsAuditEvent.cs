using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

public class SettingsAuditEvent : BaseEntity, ITenantEntity
{
    private SettingsAuditEvent() { }

    public Guid TenantId { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string ActorName { get; private set; } = string.Empty;
    public string ActorRole { get; private set; } = string.Empty;
    public string SectionId { get; private set; } = string.Empty;
    public string Action { get; private set; } = string.Empty;
    public string ResourceType { get; private set; } = string.Empty;
    public string? ResourceId { get; private set; }
    public string Summary { get; private set; } = string.Empty;
    public string? BeforeJson { get; private set; }
    public string? AfterJson { get; private set; }
    public string? CorrelationId { get; private set; }

    public static SettingsAuditEvent Create(
        Guid tenantId,
        Guid? actorUserId,
        string actorName,
        string actorRole,
        string sectionId,
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
        if (string.IsNullOrWhiteSpace(sectionId))
            throw new ArgumentException("SectionId is required.", nameof(sectionId));
        if (string.IsNullOrWhiteSpace(action))
            throw new ArgumentException("Action is required.", nameof(action));
        if (string.IsNullOrWhiteSpace(resourceType))
            throw new ArgumentException("ResourceType is required.", nameof(resourceType));
        if (string.IsNullOrWhiteSpace(summary))
            throw new ArgumentException("Summary is required.", nameof(summary));

        return new SettingsAuditEvent
        {
            TenantId = tenantId,
            OccurredAt = DateTime.UtcNow,
            ActorUserId = actorUserId,
            ActorName = string.IsNullOrWhiteSpace(actorName) ? "Unknown" : actorName.Trim(),
            ActorRole = string.IsNullOrWhiteSpace(actorRole) ? "Unknown" : actorRole.Trim(),
            SectionId = sectionId.Trim(),
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
