using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Notifications;

/// <summary>
/// Creates in-app notifications for the current tenant from any feature or domain-event handler.
/// Generalizes <see cref="CycleNotificationFactory"/> beyond cycle lifecycle: callers pass a generic
/// subject and a contextual navigation route. Creation is idempotent via the dedup key, so a handler
/// invoked more than once (at-least-once dispatch, sweep re-run) produces no duplicate.
///
/// This is self-saving so it can be used from post-commit domain-event handlers, which run their own
/// unit of work; the write does not participate in the originating business transaction.
/// </summary>
public interface IPerformanceNotifier
{
    Task NotifyAsync(
        Guid recipientEmployeeId,
        PerformanceNotificationType type,
        string title,
        string message,
        Guid? cycleId = null,
        string? subjectType = null,
        Guid? subjectId = null,
        string? navigationRoute = null,
        string? dedupKey = null,
        CancellationToken cancellationToken = default);
}

public sealed class PerformanceNotifier(
    PerformanceDbContext db,
    ITenantContext tenantContext) : IPerformanceNotifier
{
    public async Task NotifyAsync(
        Guid recipientEmployeeId,
        PerformanceNotificationType type,
        string title,
        string message,
        Guid? cycleId = null,
        string? subjectType = null,
        Guid? subjectId = null,
        string? navigationRoute = null,
        string? dedupKey = null,
        CancellationToken cancellationToken = default)
    {
        if (recipientEmployeeId == Guid.Empty)
        {
            return;
        }

        if (!string.IsNullOrWhiteSpace(dedupKey))
        {
            var exists = await db.PerformanceNotifications
                .AnyAsync(n => n.DedupKey == dedupKey, cancellationToken);
            if (exists)
            {
                return;
            }
        }

        var notification = PerformanceNotification.Create(
            tenantContext.TenantId,
            recipientEmployeeId,
            type,
            title,
            message,
            cycleId,
            dedupKey,
            subjectType,
            subjectId,
            navigationRoute);

        db.PerformanceNotifications.Add(notification);
        await db.SaveChangesAsync(cancellationToken);
    }
}
