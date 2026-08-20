using EY.HRPlatform.CoreHR.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.CoreHR.Features.Employees.Import.Services;

public interface IWorkforceImportApplyProcessor
{
    Task<bool> ProcessNextAsync(CancellationToken cancellationToken);
}

/// <summary>
/// Claims and executes one queued/stale Apply operation per call. Reconciliation is built in: if the
/// operation's session is already Committed (crash after canonical commit but before the success
/// update), the operation is marked Succeeded from the stored session result with no re-apply; a
/// stale-locked Running operation whose session is not committed is safely retried.
/// </summary>
public sealed class WorkforceImportApplyProcessor(IServiceProvider serviceProvider) : IWorkforceImportApplyProcessor
{
    private static readonly TimeSpan LockTimeout = TimeSpan.FromMinutes(10);
    private const string InMemoryProvider = "Microsoft.EntityFrameworkCore.InMemory";

    public async Task<bool> ProcessNextAsync(CancellationToken cancellationToken)
    {
        await using var scope = serviceProvider.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<CoreHRDbContext>();
        var instanceId = Guid.NewGuid().ToString("N")[..8];
        var staleThreshold = DateTime.UtcNow - LockTimeout;

        // Reconcile first: any non-terminal operation whose session is already Committed reflects a
        // canonical write that succeeded before a crash/restart — mark it Succeeded (no re-apply),
        // independent of lock age.
        if (await ReconcileCommittedAsync(db, cancellationToken)) return true;

        if (await TryClaimAsync(db, instanceId, staleThreshold, cancellationToken) == 0) return false;

        var claimed = await db.WorkforceImportApplyOperations.IgnoreQueryFilters()
            .Where(o => o.LockedBy == instanceId && (o.Status == WorkforceImportApplyStatus.Queued || o.Status == WorkforceImportApplyStatus.Running))
            .OrderBy(o => o.CreatedAt)
            .Select(o => new { o.Id, o.TenantId, o.SessionId })
            .FirstOrDefaultAsync(cancellationToken);
        if (claimed is null || claimed.TenantId == Guid.Empty) return false;

        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(claimed.TenantId);

        var op = await db.WorkforceImportApplyOperations.SingleAsync(o => o.Id == claimed.Id, cancellationToken);
        var session = await db.WorkforceImportSessions.SingleAsync(s => s.Id == claimed.SessionId, cancellationToken);

        // Reconciliation: a session already committed means the canonical write succeeded before a
        // crash/restart — report success without re-applying.
        if (session.Status == WorkforceImportStatus.Committed)
        {
            op.MarkSucceeded(session.CommitResultJson ?? "null", session.NewCount);
            await db.SaveChangesAsync(cancellationToken);
            return true;
        }

        op.AcquireLock(instanceId);
        await db.SaveChangesAsync(cancellationToken);

        var orchestrator = scope.ServiceProvider.GetRequiredService<WorkforceImportApplyOrchestrator>();
        var actor = new WorkforceImportActor(op.ActorUserId, op.ActorDisplayName);
        try
        {
            var result = await orchestrator.ExecuteAsync(claimed.SessionId, actor,
                (phase, processed, total) => { /* progress persisted opportunistically below */ }, cancellationToken);
            op.MarkSucceeded(System.Text.Json.JsonSerializer.Serialize(result), result.AddedEmployeeCount);
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (WorkforceImportApplyException failure)
        {
            db.ChangeTracker.Clear();
            var freshOp = await db.WorkforceImportApplyOperations.SingleAsync(o => o.Id == claimed.Id, cancellationToken);
            var freshSession = await db.WorkforceImportSessions.SingleOrDefaultAsync(s => s.Id == claimed.SessionId, cancellationToken);
            if (failure.Kind == WorkforceImportApplyFailureKind.ReviewOutdated)
                freshOp.MarkReviewOutdated(System.Text.Json.JsonSerializer.Serialize(failure.Outdated));
            else
                freshOp.MarkFailed(failure.Message);
            // A safely-reviewable failure returns the frozen session to review.
            if (freshSession is { Status: WorkforceImportStatus.Applying })
                freshSession.ReturnToReview(actor);
            await db.SaveChangesAsync(cancellationToken);
        }
        return true;
    }

    private static async Task<bool> ReconcileCommittedAsync(CoreHRDbContext db, CancellationToken cancellationToken)
    {
        var committedSessionIds = db.WorkforceImportSessions.IgnoreQueryFilters()
            .Where(s => s.Status == WorkforceImportStatus.Committed).Select(s => s.Id);
        var orphan = await db.WorkforceImportApplyOperations.IgnoreQueryFilters()
            .Where(o => o.Status != WorkforceImportApplyStatus.Succeeded
                && o.Status != WorkforceImportApplyStatus.Failed
                && o.Status != WorkforceImportApplyStatus.ReviewOutdated
                && committedSessionIds.Contains(o.SessionId))
            .FirstOrDefaultAsync(cancellationToken);
        if (orphan is null) return false;
        var session = await db.WorkforceImportSessions.IgnoreQueryFilters().SingleAsync(s => s.Id == orphan.SessionId, cancellationToken);
        orphan.MarkSucceeded(session.CommitResultJson ?? "null", session.NewCount);
        await db.SaveChangesAsync(cancellationToken);
        return true;
    }

    private static async Task<int> TryClaimAsync(CoreHRDbContext db, string instanceId, DateTime staleThreshold, CancellationToken cancellationToken)
    {
        var claimable = db.WorkforceImportApplyOperations.IgnoreQueryFilters()
            .Where(o => (o.Status == WorkforceImportApplyStatus.Queued || o.Status == WorkforceImportApplyStatus.Running)
                && (o.LockedAt == null || o.LockedAt < staleThreshold))
            .OrderBy(o => o.CreatedAt);

        if (string.Equals(db.Database.ProviderName, InMemoryProvider, StringComparison.OrdinalIgnoreCase))
        {
            var op = await claimable.FirstOrDefaultAsync(cancellationToken);
            if (op is null) return 0;
            op.AcquireLock(instanceId);
            await db.SaveChangesAsync(cancellationToken);
            return 1;
        }

        return await claimable.Take(1).ExecuteUpdateAsync(
            setters => setters.SetProperty(o => o.LockedAt, DateTime.UtcNow).SetProperty(o => o.LockedBy, instanceId), cancellationToken);
    }
}

public sealed class WorkforceImportApplyBackgroundService(
    IWorkforceImportApplyProcessor processor,
    ILogger<WorkforceImportApplyBackgroundService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMilliseconds(1000);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        logger.LogInformation("WorkforceImportApplyBackgroundService started.");
        await Task.Delay(TimeSpan.FromMilliseconds(300), stoppingToken);
        while (!stoppingToken.IsCancellationRequested)
        {
            var processed = false;
            try { processed = await processor.ProcessNextAsync(stoppingToken); }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Workforce import apply worker failed unexpectedly."); }
            if (!processed) await Task.Delay(Interval, stoppingToken);
        }
    }
}
