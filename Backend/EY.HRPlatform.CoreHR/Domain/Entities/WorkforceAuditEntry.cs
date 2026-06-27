using EY.HRPlatform.CoreHR.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.CoreHR.Domain.Entities;

/// <summary>
/// Append-only, tenant-scoped audit record for material workforce actions (employment
/// lifecycle, work-assignment and manager changes, import publication/correction, org-unit
/// responsible-manager changes). Written in the same transaction as the fact it describes.
/// Deliberately focused — not an event-sourcing log or a generic audit framework.
/// </summary>
public sealed class WorkforceAuditEntry : BaseEntity, ITenantEntity
{
    private WorkforceAuditEntry() { }

    public Guid TenantId { get; private set; }

    /// <summary>Affected canonical entity type, e.g. "Employment", "WorkAssignment", "ManagerRelationship", "OrgUnit".</summary>
    public string EntityType { get; private set; } = string.Empty;
    public Guid EntityId { get; private set; }

    public WorkforceAuditAction Action { get; private set; }

    /// <summary>Acting user identifier (subject/email), when available.</summary>
    public string? Actor { get; private set; }

    /// <summary>When the action was recorded.</summary>
    public DateTime OccurredAt { get; private set; }

    /// <summary>Business effective date of the change, when relevant.</summary>
    public DateTime? EffectiveDate { get; private set; }

    public WorkforceSourceType Source { get; private set; }
    public string? SourceReference { get; private set; }
    public Guid? ImportBatchId { get; private set; }

    /// <summary>Concise human-readable change detail (not a generic field-level diff).</summary>
    public string? ChangeDetails { get; private set; }

    public static WorkforceAuditEntry Record(
        Guid tenantId,
        string entityType,
        Guid entityId,
        WorkforceAuditAction action,
        WorkforceSourceType source,
        string? actor = null,
        DateTime? effectiveDate = null,
        string? sourceReference = null,
        Guid? importBatchId = null,
        string? changeDetails = null)
    {
        if (tenantId == Guid.Empty)
            throw new ArgumentException("Tenant id is required.", nameof(tenantId));
        if (string.IsNullOrWhiteSpace(entityType))
            throw new ArgumentException("Entity type is required.", nameof(entityType));
        if (entityId == Guid.Empty)
            throw new ArgumentException("Entity id is required.", nameof(entityId));

        return new WorkforceAuditEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            EntityType = entityType.Trim(),
            EntityId = entityId,
            Action = action,
            Actor = actor?.Trim(),
            OccurredAt = DateTime.UtcNow,
            EffectiveDate = effectiveDate,
            Source = source,
            SourceReference = sourceReference?.Trim(),
            ImportBatchId = importBatchId,
            ChangeDetails = changeDetails?.Trim(),
        };
    }
}
