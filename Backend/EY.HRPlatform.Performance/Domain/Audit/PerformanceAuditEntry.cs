using System.Text.Json;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Audit;

/// <summary>A consequential action, retained independently of the resource's lifecycle.</summary>
public sealed class PerformanceAuditEntry : BaseEntity, ITenantEntity
{
    private PerformanceAuditEntry() { }

    public Guid TenantId { get; private set; }
    public DateTime OccurredAt { get; private set; }
    public Guid? ActorEmployeeId { get; private set; }
    public string ActorSubject { get; private set; } = string.Empty;
    public string ResourceType { get; private set; } = string.Empty;
    public Guid ResourceId { get; private set; }
    public Guid? CycleId { get; private set; }
    public string Action { get; private set; } = string.Empty;
    public string Summary { get; private set; } = "{}";
    public string CorrelationId { get; private set; } = string.Empty;

    public static PerformanceAuditEntry Record(Guid tenantId, string resourceType, Guid resourceId,
        Guid? cycleId, string action, object summary, string actorSubject, Guid? actorEmployeeId,
        string correlationId)
    {
        if (tenantId == Guid.Empty || resourceId == Guid.Empty)
            throw new ArgumentException("Audit tenant and resource identifiers are required.");
        if (string.IsNullOrWhiteSpace(resourceType) || string.IsNullOrWhiteSpace(action)
            || string.IsNullOrWhiteSpace(actorSubject) || string.IsNullOrWhiteSpace(correlationId))
            throw new ArgumentException("Audit resource, action, actor and correlation are required.");

        return new PerformanceAuditEntry
        {
            TenantId = tenantId,
            OccurredAt = DateTime.UtcNow,
            ActorEmployeeId = actorEmployeeId,
            ActorSubject = actorSubject,
            ResourceType = resourceType,
            ResourceId = resourceId,
            CycleId = cycleId,
            Action = action,
            Summary = JsonSerializer.Serialize(summary),
            CorrelationId = correlationId,
        };
    }
}
