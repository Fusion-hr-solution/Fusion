using Microsoft.Extensions.DependencyInjection;

namespace EY.HRPlatform.Identity.Features.WorkforceBinding;

/// <summary>
/// Runs the one-time legacy-binding backfill at startup, but only when
/// <c>WorkforceBinding:RunBackfillOnStartup</c> is set. It must run (with CoreHR
/// reachable) before the membership-scoped cutover is relied upon, so existing
/// workforce-linked accounts keep their Employee identity. It fails soft: a
/// backfill error is logged and never crashes the service, and conflicts are
/// reported for controlled remediation rather than guessed.
/// </summary>
public sealed class WorkforceBindingBackfillStartupTask(
    IServiceScopeFactory scopeFactory,
    IConfiguration configuration,
    ILogger<WorkforceBindingBackfillStartupTask> logger) : IHostedService
{
    public async Task StartAsync(CancellationToken cancellationToken)
    {
        if (!configuration.GetValue<bool>("WorkforceBinding:RunBackfillOnStartup"))
        {
            return;
        }

        try
        {
            using var scope = scopeFactory.CreateScope();
            var service = scope.ServiceProvider.GetRequiredService<IWorkforceBindingBackfillService>();
            var report = await service.BackfillAsync(apply: true, cancellationToken);

            logger.LogInformation(
                "Workforce binding backfill: {Considered} considered, {Bound} bound, {AlreadyBound} already bound, {Conflicts} conflicts.",
                report.CandidatesConsidered, report.BoundCount, report.AlreadyBoundCount, report.Conflicts.Count);

            foreach (var conflict in report.Conflicts)
            {
                logger.LogWarning(
                    "Workforce binding conflict: user {UserId} employee {EmployeeId} reason {Reason}.",
                    conflict.UserId, conflict.EmployeeId, conflict.Reason);
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Workforce binding backfill failed; legacy bindings were not migrated this run.");
        }
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}
