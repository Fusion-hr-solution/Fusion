using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// An append-only audit record of a sensitive action performed against a cycle
/// (create, update, population change, publish, activate, close).
/// </summary>
public class PerformanceCycleAuditEvent : BaseEntity, ITenantEntity
{
    private PerformanceCycleAuditEvent() { }

    public Guid TenantId { get; private set; }
    public Guid CycleId { get; private set; }
    public PerformanceCycleAuditAction Action { get; private set; }
    public Guid? ActorUserId { get; private set; }
    public string? ActorName { get; private set; }
    public DateTime OccurredAt { get; private set; }

    /// <summary>Optional human-readable detail (e.g. participant count snapshotted).</summary>
    public string? Details { get; private set; }

    /// <summary>Outcome of the audited action: Success, Failure, or Rejected.</summary>
    public string? Outcome { get; private set; }

    /// <summary>Correlation id for distributed tracing across requests.</summary>
    public string? CorrelationId { get; private set; }

    public static PerformanceCycleAuditEvent Create(
        Guid tenantId,
        Guid cycleId,
        PerformanceCycleAuditAction action,
        Guid? actorUserId,
        string? actorName,
        string? details = null,
        string? outcome = "Success",
        string? correlationId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (cycleId == Guid.Empty)
            throw new ArgumentException("CycleId cannot be empty.", nameof(cycleId));

        return new PerformanceCycleAuditEvent
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            CycleId = cycleId,
            Action = action,
            ActorUserId = actorUserId,
            ActorName = actorName,
            Details = details,
            OccurredAt = DateTime.UtcNow,
            Outcome = outcome,
            CorrelationId = correlationId
        };
    }
}
