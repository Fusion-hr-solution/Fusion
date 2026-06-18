using EY.HRPlatform.Training.Features.Calendar.Reminders;
using EY.HRPlatform.Training.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Training.Features.Calendar.Sync;

/// <summary>
/// Drains the <c>CalendarSyncOutbox</c>: claims due rows (with a stale-lock guard so multiple
/// instances don't double-process), runs each through <see cref="CalendarSyncProcessor"/>, and
/// records failure + backoff on error. Training's first background service. (Reminders — Feature
/// 6.1 PR5 — will run as a second phase on this same loop.)
/// </summary>
public sealed class CalendarBackgroundService : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);
    private static readonly TimeSpan ReminderScanInterval = TimeSpan.FromMinutes(1);
    private static readonly TimeSpan LockTimeout = TimeSpan.FromMinutes(10);
    private const int BatchSize = 20;
    private const int MaxAttempts = 5;

    private readonly IServiceProvider _services;
    private readonly ILogger<CalendarBackgroundService> _logger;
    private readonly string _instanceId = Guid.NewGuid().ToString("N")[..8];
    private DateTime _lastReminderScanUtc = DateTime.MinValue;

    public CalendarBackgroundService(IServiceProvider services, ILogger<CalendarBackgroundService> logger)
    {
        _services = services;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("CalendarBackgroundService started (instance={InstanceId}).", _instanceId);
        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await DrainAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CalendarBackgroundService: drain error.");
            }

            // Second phase: the reminder scan, on a slower sub-cadence.
            try
            {
                var now = DateTime.UtcNow;
                if (now - _lastReminderScanUtc >= ReminderScanInterval)
                {
                    await ScanRemindersAsync(now, stoppingToken);
                    _lastReminderScanUtc = now;
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "CalendarBackgroundService: reminder scan error.");
            }

            await Task.Delay(Interval, stoppingToken);
        }

        _logger.LogInformation("CalendarBackgroundService stopped.");
    }

    private async Task DrainAsync(CancellationToken cancellationToken)
    {
        List<Guid> ids;
        await using (var claimScope = _services.CreateAsyncScope())
        {
            var db = claimScope.ServiceProvider.GetRequiredService<TrainingDbContext>();
            var now = DateTime.UtcNow;
            var staleBefore = now - LockTimeout;

            var claimed = await db.CalendarSyncOutboxes
                .Where(o => o.ProcessedAt == null
                            && o.NextAttemptUtc <= now
                            && o.Attempts < MaxAttempts
                            && (o.LockedAt == null || o.LockedAt < staleBefore))
                .OrderBy(o => o.CreatedAt)
                .Take(BatchSize)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(o => o.LockedAt, now)
                    .SetProperty(o => o.LockedBy, _instanceId), cancellationToken);

            if (claimed == 0) return;

            ids = await db.CalendarSyncOutboxes
                .Where(o => o.LockedBy == _instanceId && o.ProcessedAt == null)
                .OrderBy(o => o.CreatedAt)
                .Select(o => o.Id)
                .ToListAsync(cancellationToken);
        }

        // Process each row in its OWN scope/DbContext so a failed row's tracked state can never
        // bleed into the next row's writes.
        foreach (var id in ids)
        {
            await using var scope = _services.CreateAsyncScope();
            var db = scope.ServiceProvider.GetRequiredService<TrainingDbContext>();
            var processor = scope.ServiceProvider.GetRequiredService<CalendarSyncProcessor>();

            var row = await db.CalendarSyncOutboxes.FirstOrDefaultAsync(o => o.Id == id, cancellationToken);
            if (row is null || row.ProcessedAt != null) continue;

            try
            {
                await processor.ProcessAsync(row, cancellationToken);
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                throw;
            }
            catch (Exception ex)
            {
                var attempts = row.Attempts + 1;
                var backoff = TimeSpan.FromSeconds(Math.Min(300, 15 * attempts));
                row.RecordFailure(Truncate(ex.Message, 1000), DateTime.UtcNow.Add(backoff));
                await db.SaveChangesAsync(cancellationToken);

                if (attempts >= MaxAttempts)
                    _logger.LogError(ex, "Calendar sync row {RowId} dead-lettered after {Attempts} attempts.", row.Id, attempts);
                else
                    _logger.LogWarning(ex, "Calendar sync row {RowId} failed (attempt {Attempts}).", row.Id, attempts);
            }
        }
    }

    private static string Truncate(string value, int max) => value.Length <= max ? value : value[..max];

    private async Task ScanRemindersAsync(DateTime nowUtc, CancellationToken cancellationToken)
    {
        await using var scope = _services.CreateAsyncScope();
        var scanner = scope.ServiceProvider.GetRequiredService<ReminderScanner>();
        await scanner.ScanAsync(nowUtc, cancellationToken);
    }
}
