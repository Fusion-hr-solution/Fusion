using EY.HRPlatform.SharedKernel.Domain;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Append-only audit entry for platform and tenant configuration operations.
/// Does NOT implement ITenantEntity: platform-scoped entries have no TenantId, and the
/// TenantSaveChangesInterceptor rejects Guid.Empty. Service layer filters by scope/tenant.
/// </summary>
public class PerformanceConfigurationAuditEntry : BaseEntity
{
    private PerformanceConfigurationAuditEntry() { }

    /// <summary>Null for platform-scoped entries; populated for tenant-scoped entries.</summary>
    public Guid? TenantId { get; private set; }

    /// <summary>Platform or Tenant.</summary>
    public string Scope { get; private set; } = string.Empty;

    public Guid? ActorUserId { get; private set; }
    public string? ActorName { get; private set; }

    /// <summary>The audited action (e.g. GuardrailPublished, PolicyDraftCreated).</summary>
    public string Action { get; private set; } = string.Empty;

    public string EntityType { get; private set; } = string.Empty;
    public Guid EntityId { get; private set; }

    /// <summary>Policy version number or revision sequence where applicable.</summary>
    public int? VersionNumber { get; private set; }

    public DateTime OccurredAt { get; private set; }

    /// <summary>Concise before-state snapshot (JSON or human-readable diff).</summary>
    public string? PreviousValue { get; private set; }

    /// <summary>Concise after-state snapshot.</summary>
    public string? NewValue { get; private set; }

    public string? Reason { get; private set; }
    public string? CorrelationId { get; private set; }

    public static PerformanceConfigurationAuditEntry CreatePlatform(
        Guid actorUserId,
        string actorName,
        string action,
        string entityType,
        Guid entityId,
        int? versionNumber = null,
        string? previousValue = null,
        string? newValue = null,
        string? reason = null,
        string? correlationId = null)
        => Create(
            tenantId: null,
            scope: "Platform",
            actorUserId: actorUserId,
            actorName: actorName,
            action: action,
            entityType: entityType,
            entityId: entityId,
            versionNumber: versionNumber,
            previousValue: previousValue,
            newValue: newValue,
            reason: reason,
            correlationId: correlationId);

    public static PerformanceConfigurationAuditEntry CreateTenant(
        Guid tenantId,
        Guid actorUserId,
        string actorName,
        string action,
        string entityType,
        Guid entityId,
        int? versionNumber = null,
        string? previousValue = null,
        string? newValue = null,
        string? reason = null,
        string? correlationId = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("TenantId cannot be empty for a tenant-scoped audit entry.", nameof(tenantId));

        return Create(
            tenantId: tenantId,
            scope: "Tenant",
            actorUserId: actorUserId,
            actorName: actorName,
            action: action,
            entityType: entityType,
            entityId: entityId,
            versionNumber: versionNumber,
            previousValue: previousValue,
            newValue: newValue,
            reason: reason,
            correlationId: correlationId);
    }

    private static PerformanceConfigurationAuditEntry Create(
        Guid? tenantId,
        string scope,
        Guid actorUserId,
        string actorName,
        string action,
        string entityType,
        Guid entityId,
        int? versionNumber,
        string? previousValue,
        string? newValue,
        string? reason,
        string? correlationId)
    {
        if (string.IsNullOrWhiteSpace(action))
            throw new ArgumentException("Action cannot be empty.", nameof(action));
        if (string.IsNullOrWhiteSpace(entityType))
            throw new ArgumentException("EntityType cannot be empty.", nameof(entityType));
        if (entityId == Guid.Empty)
            throw new ArgumentException("EntityId cannot be empty.", nameof(entityId));

        return new PerformanceConfigurationAuditEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            Scope = scope,
            ActorUserId = actorUserId,
            ActorName = actorName.Trim(),
            Action = action.Trim(),
            EntityType = entityType.Trim(),
            EntityId = entityId,
            VersionNumber = versionNumber,
            OccurredAt = DateTime.UtcNow,
            PreviousValue = previousValue,
            NewValue = newValue,
            Reason = reason,
            CorrelationId = correlationId,
        };
    }
}
