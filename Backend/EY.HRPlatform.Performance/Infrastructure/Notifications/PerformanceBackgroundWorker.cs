using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Evidence;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

public static class PerformanceOutboxClaim
{
    /// <summary>Caller holds a transaction until delivery bookkeeping is saved.</summary>
    public static async Task<PerformanceOutboxMessage?> NextAsync(PerformanceDbContext db, DateTime now,
        CancellationToken cancellationToken)
    {
        if (db.Database.CurrentTransaction is null)
            throw new InvalidOperationException("Outbox claim requires a transaction.");
        var messages = await db.OutboxMessages.FromSqlInterpolated($"""
            SELECT * FROM performance."PerformanceOutboxMessages"
            WHERE "DispatchedAt" IS NULL AND "SkippedReason" IS NULL
              AND "Attempts" < 8 AND "NextAttemptAt" <= {now}
            ORDER BY "CreatedAt", "Id" LIMIT 1 FOR UPDATE SKIP LOCKED
            """).IgnoreQueryFilters().ToListAsync(cancellationToken);
        return messages.SingleOrDefault();
    }
}

/// <summary>Runs only within the claimed message's tenant; no global recipient/content queries.</summary>
public sealed class PerformanceNotificationDispatcher(PerformanceDbContext db, ITenantContext tenant,
    ICoreWorkforceClient workforce, IPerformanceNotificationSender sender, IOptions<PerformanceNotificationOptions> options)
{
    public async Task DispatchAsync(PerformanceOutboxMessage message, DateTime now, CancellationToken cancellationToken)
    {
        if (!tenant.IsResolved || tenant.TenantId != message.TenantId)
            throw new InvalidOperationException("Notification dispatch requires the message's tenant context.");
        if (!message.IsPending || message.NextAttemptAt > now) return;
        if (!options.Value.Enabled) message.Skip("disabled");
        else
        {
            try
            {
                var recipients = await workforce.ResolveAsync(now, [message.RecipientEmployeeId], cancellationToken);
                var email = recipients.SingleOrDefault(r => r.EmployeeId == message.RecipientEmployeeId)?.WorkEmail;
                if (string.IsNullOrWhiteSpace(email)) message.Skip("no-work-email");
                else
                {
                    await sender.SendAsync(message, email, cancellationToken);
                    message.MarkDispatched(DateTime.UtcNow);
                }
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested) { throw; }
            catch (Exception ex)
            {
                // Persist the error category, never provider exception text containing addresses or content.
                message.Fail(DateTime.UtcNow, ex.GetType().Name);
            }
        }
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class PerformanceBackgroundWorker(IServiceScopeFactory scopeFactory, ILogger<PerformanceBackgroundWorker> logger,
    EvidenceUploadSweeper sweeper, PerformanceNotificationRetention retention,
    EY.HRPlatform.Performance.Features.OneOnOnes.OneOnOneReconciler oneOnOnes)
    : BackgroundService
{
    private DateTime _nextEvidenceSweep = DateTime.UtcNow;
    private DateTime _nextOneOnOneReconciliation = DateTime.UtcNow;
    private DateTime _nextNotificationPurge = DateTime.UtcNow;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(15));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ProcessBatchAsync(stoppingToken);
                if (DateTime.UtcNow >= _nextEvidenceSweep)
                {
                    await sweeper.SweepAsync(DateTime.UtcNow, stoppingToken);
                    _nextEvidenceSweep = DateTime.UtcNow.AddHours(1);
                }
                if (DateTime.UtcNow >= _nextOneOnOneReconciliation)
                {
                    // Set first: a Core outage shouldn't turn this into a retry every tick.
                    _nextOneOnOneReconciliation = DateTime.UtcNow.AddMinutes(15);
                    await oneOnOnes.ReconcileAsync(DateTime.UtcNow, stoppingToken);
                }
                if (DateTime.UtcNow >= _nextNotificationPurge)
                {
                    await retention.PurgeAsync(DateTime.UtcNow, stoppingToken);
                    _nextNotificationPurge = DateTime.UtcNow.AddDays(1);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex)
            {
                logger.LogWarning("Performance background work failed ({ErrorType}).", ex.GetType().Name);
            }
        }
    }

    public async Task ProcessBatchAsync(CancellationToken cancellationToken)
    {
        // Small bounded batch, one row lock and a fresh tenant scope per message.
        for (var i = 0; i < 20; i++)
        {
            await using var scope = scopeFactory.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
            var message = await PerformanceOutboxClaim.NextAsync(db, DateTime.UtcNow, cancellationToken);
            if (message is null) break;
            scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(message.TenantId);
            var dispatcher = scope.ServiceProvider.GetRequiredService<PerformanceNotificationDispatcher>();
            await dispatcher.DispatchAsync(message, DateTime.UtcNow, cancellationToken);
            await transaction.CommitAsync(cancellationToken);
        }
    }
}
