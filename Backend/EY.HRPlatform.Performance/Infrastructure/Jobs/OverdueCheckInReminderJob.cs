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
/// Reminds the current effective reviewer when a Planned check-in's planned date has passed without
/// completion or cancellation. Overdue is derived from the planned date and current time and is never
/// persisted as a status. Idempotent per check-in and day bucket, so at most one overdue reminder per
/// day per check-in. Never mutates check-in state.
/// </summary>
public sealed class OverdueCheckInReminderJob(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<OverdueCheckInReminderJob> logger) : IScheduledJob
{
    public string Name => "overdue-checkin-reminders";

    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.SweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;

        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await dbContext.PerformanceCheckIns
                .IgnoreQueryFilters()
                .Where(checkIn => checkIn.Status == CheckInStatus.Planned && checkIn.PlannedDate < now.Date)
                .Select(checkIn => checkIn.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
            total += await ProcessTenantAsync(tenantId, now, cancellationToken);
        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, DateTime now, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var reviewerResolver = scope.ServiceProvider.GetRequiredService<EffectiveReviewerResolver>();

        var overdue = await dbContext.PerformanceCheckIns
            .AsNoTracking()
            .Where(checkIn => checkIn.Status == CheckInStatus.Planned && checkIn.PlannedDate < now.Date)
            .Join(
                dbContext.PerformanceCycles,
                checkIn => checkIn.CycleId,
                cycle => cycle.Id,
                (checkIn, cycle) => new
                {
                    checkIn.Id,
                    checkIn.EmployeeId,
                    checkIn.CycleId,
                    checkIn.PlannedDate,
                    cycle.Slug,
                })
            .ToListAsync(cancellationToken);
        if (overdue.Count == 0)
            return 0;

        var dayBucket = now.Date.Ticks;
        var candidateKeys = overdue.Select(item => $"checkin-overdue:{item.Id}:{dayBucket}").ToList();
        var existing = (await dbContext.PerformanceNotifications
                .Where(notification => notification.DedupKey != null && candidateKeys.Contains(notification.DedupKey))
                .Select(notification => notification.DedupKey!)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        var reviewerByCycle = new Dictionary<Guid, Dictionary<Guid, Guid>>();
        var newNotifications = new List<PerformanceNotification>();

        foreach (var item in overdue)
        {
            var dedupKey = $"checkin-overdue:{item.Id}:{dayBucket}";
            if (existing.Contains(dedupKey))
                continue;

            if (!reviewerByCycle.TryGetValue(item.CycleId, out var reviewers))
            {
                reviewers = await reviewerResolver.ResolveForCampaignAsync(item.CycleId, cancellationToken);
                reviewerByCycle[item.CycleId] = reviewers;
            }
            if (!reviewers.TryGetValue(item.EmployeeId, out var reviewerId) || reviewerId == Guid.Empty)
                continue;

            newNotifications.Add(PerformanceNotification.Create(
                tenantId,
                reviewerId,
                PerformanceNotificationType.CheckInOverdue,
                title: "A planned check-in is overdue",
                message: $"A check-in planned for {item.PlannedDate:MMM d, yyyy} has not been completed.",
                cycleId: item.CycleId,
                dedupKey: dedupKey,
                subjectType: "PerformanceCheckIn",
                subjectId: item.Id,
                navigationRoute: $"/team-progress/{item.Slug}/check-ins/{item.Id}"));
        }

        if (newNotifications.Count == 0)
            return 0;

        dbContext.PerformanceNotifications.AddRange(newNotifications);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} overdue-check-in reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
        return newNotifications.Count;
    }
}
