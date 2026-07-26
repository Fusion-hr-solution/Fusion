using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Infrastructure.Persistence;

namespace EY.HRPlatform.Performance.Features.ConfigurationAudit;

public interface IConfigurationAuditWriter
{
    Task AppendPlatformAsync(
        Guid actorUserId,
        string actorName,
        string action,
        string entityType,
        Guid entityId,
        int? versionNumber = null,
        string? previousValue = null,
        string? newValue = null,
        string? reason = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default);

    Task AppendTenantAsync(
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
        string? correlationId = null,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// Appends append-only configuration audit entries to the database.
/// Callers are responsible for calling SaveChangesAsync on the surrounding unit of work.
/// </summary>
public sealed class ConfigurationAuditWriter(PerformanceDbContext db) : IConfigurationAuditWriter
{
    public Task AppendPlatformAsync(
        Guid actorUserId,
        string actorName,
        string action,
        string entityType,
        Guid entityId,
        int? versionNumber = null,
        string? previousValue = null,
        string? newValue = null,
        string? reason = null,
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        var entry = PerformanceConfigurationAuditEntry.CreatePlatform(
            actorUserId, actorName, action, entityType, entityId,
            versionNumber, previousValue, newValue, reason, correlationId);

        db.PerformanceConfigurationAuditEntries.Add(entry);
        return Task.CompletedTask;
    }

    public Task AppendTenantAsync(
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
        string? correlationId = null,
        CancellationToken cancellationToken = default)
    {
        var entry = PerformanceConfigurationAuditEntry.CreateTenant(
            tenantId, actorUserId, actorName, action, entityType, entityId,
            versionNumber, previousValue, newValue, reason, correlationId);

        db.PerformanceConfigurationAuditEntries.Add(entry);
        return Task.CompletedTask;
    }
}
