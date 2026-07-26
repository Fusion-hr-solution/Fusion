using System.Text.Json;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Features.ActivityLog;

/// <summary>
/// Writes append-only business-activity records to the shared activity log.
/// Mirrors <see cref="ConfigurationAudit.ConfigurationAuditWriter"/>: entries are added to the
/// tracked context and the caller owns the surrounding <c>SaveChangesAsync</c>, so activity is
/// written in the same unit of work as the business change (or the caller's explicit save).
/// </summary>
public interface IActivityLog
{
    /// <summary>
    /// Records a business activity for the current tenant. Actor defaults to the current user when
    /// not supplied (null for system-initiated activity such as background sweeps). Metadata, when
    /// supplied, is serialized to JSON and stored as jsonb.
    /// </summary>
    void Record(
        string action,
        string subjectType,
        Guid subjectId,
        object? metadata = null,
        Guid? actorUserId = null,
        string? actorName = null,
        string? correlationId = null);
}

public sealed class ActivityLogWriter(
    PerformanceDbContext db,
    ITenantContext tenantContext,
    ICurrentUserContext currentUser) : IActivityLog
{
    public void Record(
        string action,
        string subjectType,
        Guid subjectId,
        object? metadata = null,
        Guid? actorUserId = null,
        string? actorName = null,
        string? correlationId = null)
    {
        var metadataJson = metadata is null
            ? null
            : metadata as string ?? JsonSerializer.Serialize(metadata);

        var entry = ActivityLogEntry.Create(
            tenantContext.TenantId,
            actorUserId ?? currentUser.UserId,
            actorName ?? currentUser.FullName,
            action,
            subjectType,
            subjectId,
            metadataJson,
            correlationId ?? currentUser.CorrelationId);

        db.ActivityLogEntries.Add(entry);
    }
}
