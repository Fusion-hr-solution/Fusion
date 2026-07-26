using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Append-only, tenant-scoped business-activity record with a generic actor/action/subject model.
/// Unlike the feature-scoped audit tables (configuration audit, cycle audit, exception history),
/// this is the shared spine any Performance feature — and later any Core resource — can write to
/// without schema churn, because the subject is an opaque (type, id) pair rather than a foreign key.
/// Once written, an entry cannot be modified or deleted (enforced by <see cref="Infrastructure.Persistence.PerformanceDbContext"/>).
/// </summary>
public class ActivityLogEntry : BaseEntity, ITenantEntity
{
    private ActivityLogEntry() { }

    public Guid TenantId { get; private set; }

    /// <summary>The user who performed the action; null for system-initiated activity (e.g. sweeps).</summary>
    public Guid? ActorUserId { get; private set; }

    /// <summary>Display name of the actor; "System" for system-initiated activity.</summary>
    public string ActorName { get; private set; } = string.Empty;

    /// <summary>The action code (e.g. PlanApproved, CycleClosed, AttachmentUploaded).</summary>
    public string Action { get; private set; } = string.Empty;

    /// <summary>Opaque subject type (e.g. EmployeeObjectivePlan, PerformanceCycle, Attachment).</summary>
    public string SubjectType { get; private set; } = string.Empty;

    /// <summary>Identifier of the subject the action was performed on.</summary>
    public Guid SubjectId { get; private set; }

    public DateTime OccurredAt { get; private set; }

    /// <summary>Optional structured metadata, stored as jsonb. Null when no metadata is supplied.</summary>
    public string? Metadata { get; private set; }

    public string? CorrelationId { get; private set; }

    public static ActivityLogEntry Create(
        Guid tenantId,
        Guid? actorUserId,
        string? actorName,
        string action,
        string subjectType,
        Guid subjectId,
        string? metadata = null,
        string? correlationId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(action))
            throw new ArgumentException("Action cannot be empty.", nameof(action));
        if (string.IsNullOrWhiteSpace(subjectType))
            throw new ArgumentException("SubjectType cannot be empty.", nameof(subjectType));
        if (subjectId == Guid.Empty)
            throw new ArgumentException("SubjectId cannot be empty.", nameof(subjectId));

        return new ActivityLogEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ActorUserId = actorUserId,
            ActorName = string.IsNullOrWhiteSpace(actorName) ? "System" : actorName.Trim(),
            Action = action.Trim(),
            SubjectType = subjectType.Trim(),
            SubjectId = subjectId,
            OccurredAt = DateTime.UtcNow,
            Metadata = string.IsNullOrWhiteSpace(metadata) ? null : metadata,
            CorrelationId = correlationId,
        };
    }
}
