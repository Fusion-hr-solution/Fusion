using EY.HRPlatform.Interview.Domain.Enums;
using EY.HRPlatform.Interview.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Interview.Features.Grading;

public class GradingBackgroundService(
    IServiceProvider serviceProvider,
    ILogger<GradingBackgroundService> logger)
    : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(1000);
    private static readonly TimeSpan LockTimeout = TimeSpan.FromMinutes(10);
    private readonly string _instanceId = Guid.NewGuid().ToString("N")[..8];

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("GradingBackgroundService started (instance={InstanceId}).", _instanceId);

        await Task.Delay(TimeSpan.FromSeconds(5), stoppingToken);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await ProcessNextJobAsync(stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "GradingBackgroundService: unhandled error.");
            }

            await Task.Delay(Interval, stoppingToken);
        }

        logger.LogInformation("GradingBackgroundService stopped.");
    }

    private async Task ProcessNextJobAsync(CancellationToken ct)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

        var staleThreshold = DateTime.UtcNow - LockTimeout;

        var acquired = await db.GradingJobs
            .Where(j => j.CompletedAt == null
                        && j.FailedAt == null
                        && j.RetryCount < 3
                        && (j.LockedAt == null || j.LockedAt < staleThreshold))
            .OrderBy(j => j.CreatedAt)
            .Take(1)
            .ExecuteUpdateAsync(s => s
                .SetProperty(j => j.LockedAt, DateTime.UtcNow)
                .SetProperty(j => j.LockedBy, _instanceId),
                ct);

        if (acquired == 0)
            return;

        var job = await db.GradingJobs
            .Where(j => j.LockedBy == _instanceId && j.CompletedAt == null && j.FailedAt == null)
            .OrderBy(j => j.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (job is null)
            return;

        logger.LogInformation("GradingBackgroundService: grading attempt {AttemptId} (job={JobId}).", job.AttemptId, job.Id);

        try
        {
            var orchestrator = scope.ServiceProvider.GetRequiredService<GradingOrchestrator>();

            // Grade the attempt and mark the job complete inside ONE transaction so the
            // QuestionGradeResults, attempt totals, and job.CompletedAt all commit
            // together or not at all. The orchestrator shares this DbContext, so its
            // SaveChanges enlist in this transaction. Without it, a crash after grading
            // but before CompletedAt is saved would leave results committed and the job
            // reclaimable — re-grading it and producing duplicate results / wrong totals.
            await using var transaction = await db.Database.BeginTransactionAsync(ct);

            await orchestrator.GradeAttemptAsync(job.AttemptId, ct);

            job.CompletedAt = DateTime.UtcNow;
            job.LockedAt = null;
            job.LockedBy = null;
            await db.SaveChangesAsync(ct);

            await transaction.CommitAsync(ct);

            logger.LogInformation("GradingBackgroundService: completed job {JobId}.", job.Id);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "GradingBackgroundService: job {JobId} failed (retry={Retry}).", job.Id, job.RetryCount + 1);

            job.RetryCount += 1;
            job.ErrorMessage = ex.Message.Length > 2000 ? ex.Message[..2000] : ex.Message;

            if (job.RetryCount >= 3)
            {
                job.FailedAt = DateTime.UtcNow;
                await db.GradingJobs
                    .Where(j => j.Id == job.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RetryCount, job.RetryCount)
                        .SetProperty(j => j.ErrorMessage, job.ErrorMessage)
                        .SetProperty(j => j.FailedAt, job.FailedAt)
                        .SetProperty(j => j.LockedAt, (DateTime?)null)
                        .SetProperty(j => j.LockedBy, (string?)null),
                        ct);

                await db.CandidateTestAttempts
                    .Where(a => a.Id == job.AttemptId)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(a => a.GradingStatus, GradingStatus.Failed),
                        ct);
            }
            else
            {
                await db.GradingJobs
                    .Where(j => j.Id == job.Id)
                    .ExecuteUpdateAsync(s => s
                        .SetProperty(j => j.RetryCount, job.RetryCount)
                        .SetProperty(j => j.ErrorMessage, job.ErrorMessage)
                        .SetProperty(j => j.LockedAt, (DateTime?)null)
                        .SetProperty(j => j.LockedBy, (string?)null),
                        ct);
            }
        }
    }
}
