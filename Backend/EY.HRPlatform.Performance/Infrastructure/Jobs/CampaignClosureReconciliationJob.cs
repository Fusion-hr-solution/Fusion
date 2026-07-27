using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Closes any campaign that meets the automatic-closure condition but was not closed by the inline
/// path in the finalize transaction.
/// </summary>
/// <remarks>
/// The self-healing layer behind auto-close (design D3). The inline path is the primary mechanism;
/// this catches the cases it cannot see — a finalization that raced another, or a campaign that
/// became eligible through a participant exclusion rather than through a finalization, where no
/// finalize transaction ran at all.
/// </remarks>
public sealed class CampaignClosureReconciliationJob(
    IServiceProvider services,
    IOptions<ScheduledJobsOptions> options,
    ILogger<CampaignClosureReconciliationJob> logger) : IScheduledJob
{
    public string Name => "campaign-closure-reconciliation";

    /// <summary>
    /// Low frequency on purpose: this is a backstop, not the mechanism. Anything it finds was
    /// already supposed to have closed.
    /// </summary>
    public TimeSpan Interval => TimeSpan.FromMinutes(
        Math.Max(1, options.Value.CampaignClosureReconciliationIntervalMinutes));

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        List<(Guid TenantId, Guid CampaignId)> candidates;
        using (var scope = services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();

            // Only launched campaigns that have at least one launched round can be eligible, so the
            // swept set does not grow with closed-campaign history.
            candidates = (await dbContext.PerformanceCycles
                    .IgnoreQueryFilters()
                    .AsNoTracking()
                    .Where(cycle => cycle.Status == PerformanceCycleStatus.Launched)
                    .Where(cycle => dbContext.EvaluationRounds
                        .IgnoreQueryFilters()
                        .Any(round => round.PerformanceCycleId == cycle.Id
                                      && round.Status == EvaluationRoundStatus.Launched))
                    .Select(cycle => new { cycle.TenantId, CampaignId = cycle.Id })
                    .ToListAsync(cancellationToken))
                .Select(row => (row.TenantId, row.CampaignId))
                .ToList();
        }

        var closed = 0;
        foreach (var (tenantId, campaignId) in candidates)
        {
            if (await TryCloseAsync(tenantId, campaignId, cancellationToken))
            {
                closed++;
            }
        }

        return closed;
    }

    private async Task<bool> TryCloseAsync(Guid tenantId, Guid campaignId, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);

        var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var eligibility = scope.ServiceProvider.GetRequiredService<CampaignClosureEligibilityResolver>();

        if (!await eligibility.IsEligibleForAutomaticClosureAsync(campaignId, cancellationToken))
        {
            return false;
        }

        var closer = scope.ServiceProvider.GetRequiredService<CampaignCloser>();

        // No actor: the platform closed this, not a person.
        if (!await closer.StageCloseAsync(
                campaignId,
                CampaignClosureKind.Automatic,
                actorUserId: null,
                actorName: null,
                DateTime.UtcNow,
                cancellationToken))
        {
            return false;
        }

        try
        {
            await dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            // The inline path closed it first. Exactly one closure record either way.
            logger.LogDebug(
                "Campaign {CampaignId} was closed concurrently; leaving the existing closure record.",
                campaignId);
            return false;
        }

        logger.LogInformation(
            "Reconciliation closed campaign {CampaignId} for tenant {TenantId}.", campaignId, tenantId);
        return true;
    }
}
