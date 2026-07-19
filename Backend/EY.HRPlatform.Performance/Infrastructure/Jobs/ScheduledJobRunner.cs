using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Single hosted runner that ticks each registered <see cref="IScheduledJob"/> on its own interval,
/// outside any HTTP request. Each tick is guarded by a Postgres advisory lock keyed by job name, so
/// at most one service instance runs a given sweep at a time (others skip the tick). Every execution
/// — success, failure, or skip — is recorded in the <see cref="ScheduledJobRun"/> ledger.
/// </summary>
public sealed class ScheduledJobRunner(
    IServiceProvider services,
    IEnumerable<IScheduledJob> jobs,
    IAdvisoryLock advisoryLock,
    IOptions<ScheduledJobsOptions> options,
    ILogger<ScheduledJobRunner> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Value.Enabled)
        {
            logger.LogInformation("Scheduled job runner disabled by configuration.");
            return;
        }

        // Let migrations/seeding settle before the first sweep.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var runnable = jobs.Where(j => j.Interval > TimeSpan.Zero).ToList();
        if (runnable.Count == 0)
        {
            logger.LogInformation("Scheduled job runner has no enabled jobs.");
            return;
        }

        await Task.WhenAll(runnable.Select(job => RunLoopAsync(job, stoppingToken)));
    }

    private async Task RunLoopAsync(IScheduledJob job, CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(job.Interval);
        do
        {
            try
            {
                await TickAsync(job, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Scheduled job {JobName} tick failed.", job.Name);
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    /// <summary>One guarded execution of a job. Internal so the lock/skip/record behaviour is testable.</summary>
    internal async Task<ScheduledJobRunStatus> TickAsync(IScheduledJob job, CancellationToken cancellationToken)
    {
        var handle = await advisoryLock.TryAcquireAsync(job.Name, cancellationToken);
        if (handle is null)
        {
            logger.LogDebug("Scheduled job {JobName} skipped: another instance holds the lock.", job.Name);
            await RecordAsync(job.Name, ScheduledJobRunStatus.Skipped, 0, null, cancellationToken);
            return ScheduledJobRunStatus.Skipped;
        }

        var startedAt = DateTime.UtcNow;
        try
        {
            var items = await job.ExecuteAsync(cancellationToken);
            await RecordAsync(job.Name, ScheduledJobRunStatus.Succeeded, items, null, cancellationToken, startedAt);
            return ScheduledJobRunStatus.Succeeded;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Scheduled job {JobName} failed.", job.Name);
            await RecordAsync(job.Name, ScheduledJobRunStatus.Failed, 0, ex.Message, cancellationToken, startedAt);
            return ScheduledJobRunStatus.Failed;
        }
        finally
        {
            await handle.DisposeAsync();
        }
    }

    private async Task RecordAsync(
        string jobName,
        ScheduledJobRunStatus status,
        int items,
        string? error,
        CancellationToken cancellationToken,
        DateTime? startedAt = null)
    {
        try
        {
            using var scope = services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            var run = ScheduledJobRun.Start(jobName, startedAt ?? DateTime.UtcNow);
            run.Complete(status, items, DateTime.UtcNow, error);
            db.ScheduledJobRuns.Add(run);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to record run-history for job {JobName}.", jobName);
        }
    }
}
