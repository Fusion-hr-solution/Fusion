using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Reminds employees of objectives whose progress has gone stale on a locked campaign's approved
/// plan. Idempotent per objective and staleness window: the dedup key is anchored to the objective's
/// current staleness reference (its newest update, or the planning-lock time when it has none), so
/// repeated runs inside the same silent window never re-notify, while a fresh update that later goes
/// stale again advances the reference and can produce a new reminder.
/// </summary>
public sealed class StaleProgressReminderJob(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<StaleProgressReminderJob> logger) : IScheduledJob
{
    public string Name => "stale-progress-reminders";

    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.SweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await dbContext.PerformanceCycles
                .IgnoreQueryFilters()
                .Where(cycle => cycle.Status == PerformanceCycleStatus.Launched && cycle.PlanningLockedAt != null)
                .Select(cycle => cycle.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
        {
            total += await ProcessTenantAsync(tenantId, cancellationToken);
        }

        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var now = DateTime.UtcNow;

        var lockedCycles = await dbContext.PerformanceCycles
            .AsNoTracking()
            .Where(cycle => cycle.Status == PerformanceCycleStatus.Launched && cycle.PlanningLockedAt != null)
            .Select(cycle => new { cycle.Id, cycle.Name, cycle.PlanningLockedAt })
            .ToListAsync(cancellationToken);

        var newNotifications = new List<PerformanceNotification>();

        foreach (var cycle in lockedCycles)
        {
            var plans = await dbContext.EmployeeObjectivePlans
                .AsNoTracking()
                .Include(plan => plan.Objectives)
                .Where(plan => plan.CycleId == cycle.Id && plan.Status == PlanStatus.Approved)
                .ToListAsync(cancellationToken);
            if (plans.Count == 0)
                continue;

            var planIds = plans.Select(plan => plan.Id).ToList();
            var latestByObjective = await ObjectiveProgressQueries.GetLatestByObjectiveAsync(
                dbContext, planIds, cancellationToken);

            var candidates = new List<(Guid EmployeeId, Guid ObjectiveId, string Title, long ReferenceTicks)>();
            foreach (var plan in plans)
            {
                foreach (var objective in plan.Objectives)
                {
                    latestByObjective.TryGetValue(objective.Id, out var latest);
                    if (!ObjectiveProgressRules.IsStale(latest?.Percent, latest?.RecordedAt, cycle.PlanningLockedAt, now))
                        continue;

                    var reference = latest?.RecordedAt ?? cycle.PlanningLockedAt!.Value;
                    candidates.Add((plan.EmployeeId, objective.Id, objective.Title, reference.Ticks));
                }
            }

            if (candidates.Count == 0)
                continue;

            var candidateKeys = candidates
                .Select(candidate => $"stale-progress:{candidate.ObjectiveId}:{candidate.ReferenceTicks}")
                .ToList();
            var existing = await dbContext.PerformanceNotifications
                .Where(notification => notification.DedupKey != null && candidateKeys.Contains(notification.DedupKey))
                .Select(notification => notification.DedupKey!)
                .ToListAsync(cancellationToken);
            var existingSet = existing.ToHashSet(StringComparer.Ordinal);

            foreach (var candidate in candidates)
            {
                var dedupKey = $"stale-progress:{candidate.ObjectiveId}:{candidate.ReferenceTicks}";
                if (existingSet.Contains(dedupKey))
                    continue;

                newNotifications.Add(PerformanceNotification.Create(
                    tenantId,
                    candidate.EmployeeId,
                    PerformanceNotificationType.ObjectiveProgressStale,
                    title: "An objective needs a progress update",
                    message: $"\"{candidate.Title}\" in \"{cycle.Name}\" hasn't been updated recently.",
                    cycleId: cycle.Id,
                    dedupKey: dedupKey,
                    subjectType: "EmployeeObjectivePlan",
                    navigationRoute: "/my-objectives"));
            }
        }

        if (newNotifications.Count == 0)
            return 0;

        dbContext.PerformanceNotifications.AddRange(newNotifications);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} stale-progress reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
        return newNotifications.Count;
    }
}
