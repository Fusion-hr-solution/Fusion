using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.SharedKernel.Domain;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Domain.Entities;

/// <summary>
/// Append-only record of a single progress update on an objective (D-14).
/// Owner updates and manager corrections both produce an entry; manager corrections
/// additionally emit a governance audit event (PerformanceCycleAuditEvent).
/// </summary>
public sealed class ObjectiveProgressEntry : BaseEntity, ITenantEntity
{
    private ObjectiveProgressEntry() { }

    public Guid TenantId { get; private set; }
    public Guid ObjectiveId { get; private set; }
    public Guid ActorEmployeeId { get; private set; }
    public string? ActorName { get; private set; }
    public ObjectiveProgressMode Mode { get; private set; }
    public decimal? PreviousPercent { get; private set; }
    public decimal? NewPercent { get; private set; }
    public string? Comment { get; private set; }

    /// <summary>Source of the update e.g. "OwnerUpdate" or "ManagerCorrection".</summary>
    public string Source { get; private set; } = string.Empty;

    public DateTime OccurredAt { get; private set; }

    public static ObjectiveProgressEntry Create(
        Guid tenantId,
        Guid objectiveId,
        Guid actorEmployeeId,
        string? actorName,
        ObjectiveProgressMode mode,
        decimal? previousPercent,
        decimal? newPercent,
        string source,
        string? comment = null)
    {
        if (tenantId == Guid.Empty || objectiveId == Guid.Empty || actorEmployeeId == Guid.Empty)
            throw new ArgumentException("Tenant, objective, and actor are required.");
        if (string.IsNullOrWhiteSpace(source))
            throw new ArgumentException("Source is required.", nameof(source));

        return new ObjectiveProgressEntry
        {
            Id = Guid.NewGuid(),
            TenantId = tenantId,
            ObjectiveId = objectiveId,
            ActorEmployeeId = actorEmployeeId,
            ActorName = actorName,
            Mode = mode,
            PreviousPercent = previousPercent,
            NewPercent = newPercent,
            Source = source,
            Comment = comment,
            OccurredAt = DateTime.UtcNow,
        };
    }
}
