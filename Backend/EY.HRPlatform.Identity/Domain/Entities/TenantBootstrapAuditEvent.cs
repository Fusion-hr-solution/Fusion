using EY.HRPlatform.Identity.Domain.Enums;

namespace EY.HRPlatform.Identity.Domain.Entities;

/// <summary>
/// One bounded bootstrap history entry. Detailed permission changes stay in the
/// existing Identity access audit; this record explains the bootstrap outcome
/// only, and never carries credentials, request payloads, or raw provider errors.
/// </summary>
public class TenantBootstrapAuditEvent
{
    /// <summary>Upper bound on stored metadata, enforced by the domain and the column length.</summary>
    public const int MetadataMaxLength = 1024;

    private TenantBootstrapAuditEvent() { } // EF constructor

    public Guid Id { get; private set; }

    public TenantBootstrapAuditEventType EventType { get; private set; }

    public Guid TenantId { get; private set; }

    public Guid? InvitationId { get; private set; }

    /// <summary>Account that caused the event. Null for system-initiated outcomes.</summary>
    public Guid? ActorAccountId { get; private set; }

    public DateTime OccurredAt { get; private set; }

    /// <summary>Bounded outcome label, for example Succeeded or Failed.</summary>
    public string Outcome { get; private set; } = string.Empty;

    /// <summary>Bounded machine-readable reason. Never a raw provider message.</summary>
    public string? Reason { get; private set; }

    /// <summary>One correlation identifier tying related bootstrap records together.</summary>
    public Guid CorrelationId { get; private set; }

    /// <summary>Sanitized, size-bounded metadata.</summary>
    public string? Metadata { get; private set; }

    public static TenantBootstrapAuditEvent Create(
        TenantBootstrapAuditEventType eventType,
        Guid tenantId,
        Guid correlationId,
        string outcome,
        Guid? invitationId = null,
        Guid? actorAccountId = null,
        string? reason = null,
        string? metadata = null,
        DateTime? occurredAt = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant ID is required.", nameof(tenantId));

        if (correlationId == Guid.Empty)
            throw new ArgumentException("Correlation ID is required.", nameof(correlationId));

        if (string.IsNullOrWhiteSpace(outcome))
            throw new ArgumentException("Outcome is required.", nameof(outcome));

        if (metadata is { Length: > MetadataMaxLength })
            throw new ArgumentException(
                $"Metadata cannot exceed {MetadataMaxLength} characters.", nameof(metadata));

        return new TenantBootstrapAuditEvent
        {
            Id = Guid.NewGuid(),
            EventType = eventType,
            TenantId = tenantId,
            InvitationId = invitationId,
            ActorAccountId = actorAccountId,
            OccurredAt = occurredAt ?? DateTime.UtcNow,
            Outcome = outcome.Trim(),
            Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim(),
            CorrelationId = correlationId,
            Metadata = string.IsNullOrWhiteSpace(metadata) ? null : metadata.Trim(),
        };
    }
}
