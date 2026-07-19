using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Detects planning inactivity: participants of an in-flight cycle whose objective plan is still
/// unsubmitted beyond a configured window after planning opened, and nudges them with a deduplicated
/// reminder. Idempotent via a stable per-participant dedup key, so re-running the sweep over the same
/// state creates nothing new.
/// </summary>
public sealed class InactivitySweepJob(
    IServiceProvider services,
    IOptions<ScheduledJobsOptions> options,
    ILogger<InactivitySweepJob> logger) : IScheduledJob
{
    public string Name => "inactivity-sweep";

    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.InactivitySweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await db.PerformanceCycles
                .IgnoreQueryFilters()
                .Where(c => (c.Status == PerformanceCycleStatus.Launched || c.Status == PerformanceCycleStatus.Active)
                    && c.PlanningOpeningDate != null)
                .Select(c => c.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
        {
            total += await ProcessTenantAsync(tenantId, options.Value, cancellationToken);
        }

        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, ScheduledJobsOptions settings, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var now = DateTime.UtcNow;
        var threshold = TimeSpan.FromDays(Math.Max(1, settings.InactivityThresholdDays));

        var cycles = await db.PerformanceCycles
            .Include(c => c.Participants)
            .Where(c => (c.Status == PerformanceCycleStatus.Launched || c.Status == PerformanceCycleStatus.Active)
                && c.PlanningOpeningDate != null)
            .ToListAsync(cancellationToken);

        var newNotifications = new List<PerformanceNotification>();

        foreach (var cycle in cycles)
        {
            var openedAt = cycle.PlanningOpeningDate ?? cycle.PeriodStart;
            if (now - openedAt < threshold)
            {
                continue;
            }

            // Participants who have not yet submitted (Draft, ChangesRequested, or no plan at all).
            var submittedEmployeeIds = await db.EmployeeObjectivePlans
                .Where(p => p.CycleId == cycle.Id
                    && (p.Status == PlanStatus.Submitted || p.Status == PlanStatus.Approved))
                .Select(p => p.EmployeeId)
                .ToListAsync(cancellationToken);
            var submittedSet = submittedEmployeeIds.ToHashSet();

            var candidates = cycle.Participants
                .Where(p => !submittedSet.Contains(p.EmployeeId))
                .Select(p => (p.EmployeeId, DedupKey: $"inactivity:{cycle.Id}:{p.EmployeeId}"))
                .ToList();
            if (candidates.Count == 0)
            {
                continue;
            }

            var candidateKeys = candidates.Select(c => c.DedupKey).ToList();
            var existingKeys = await db.PerformanceNotifications
                .Where(n => n.DedupKey != null && candidateKeys.Contains(n.DedupKey))
                .Select(n => n.DedupKey!)
                .ToListAsync(cancellationToken);
            var existingSet = existingKeys.ToHashSet(StringComparer.Ordinal);

            foreach (var candidate in candidates.Where(c => !existingSet.Contains(c.DedupKey)))
            {
                newNotifications.Add(PerformanceNotification.Create(
                    cycle.TenantId,
                    candidate.EmployeeId,
                    PerformanceNotificationType.PlanningReminder,
                    title: "Your objective plan is still open",
                    message: $"You haven't submitted your objective plan for \"{cycle.Name}\" yet.",
                    cycleId: cycle.Id,
                    dedupKey: candidate.DedupKey,
                    subjectType: "PerformanceCycle",
                    subjectId: cycle.Id,
                    navigationRoute: "/my-objectives"));
            }
        }

        if (newNotifications.Count == 0)
        {
            return 0;
        }

        db.PerformanceNotifications.AddRange(newNotifications);
        await db.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} inactivity reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
        return newNotifications.Count;
    }
}
