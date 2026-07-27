using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Reminds a participant of a Planned check-in as its planned date approaches, within a small fixed
/// window. Idempotent per check-in and planned-date bucket: the dedup key is anchored to the check-in
/// id and its current planned date, so repeated ticks inside the same window never re-notify, while a
/// reschedule advances the bucket and can produce a fresh reminder. Never mutates check-in state.
/// </summary>
public sealed class UpcomingCheckInReminderJob(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<UpcomingCheckInReminderJob> logger) : IScheduledJob
{
    public string Name => "upcoming-checkin-reminders";

    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.SweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        var windowDays = Math.Max(1, options.Value.CheckInUpcomingWindowDays);
        var now = DateTime.UtcNow;
        var horizon = now.AddDays(windowDays);

        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await dbContext.PerformanceCheckIns
                .IgnoreQueryFilters()
                .Where(checkIn => checkIn.Status == CheckInStatus.Planned
                                  && checkIn.PlannedDate >= now.Date
                                  && checkIn.PlannedDate <= horizon)
                .Select(checkIn => checkIn.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
            total += await ProcessTenantAsync(tenantId, now, horizon, cancellationToken);
        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, DateTime now, DateTime horizon, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();

        var upcoming = await dbContext.PerformanceCheckIns
            .AsNoTracking()
            .Where(checkIn => checkIn.Status == CheckInStatus.Planned
                              && checkIn.PlannedDate >= now.Date
                              && checkIn.PlannedDate <= horizon)
            // Closed campaigns generate no reminders.
            .Where(checkIn => dbContext.PerformanceCycles.OpenOnly()
                .Any(campaign => campaign.Id == checkIn.CycleId))
            .Select(checkIn => new { checkIn.Id, checkIn.EmployeeId, checkIn.CycleId, checkIn.PlannedDate })
            .ToListAsync(cancellationToken);
        if (upcoming.Count == 0)
            return 0;

        var candidateKeys = upcoming
            .Select(item => $"checkin-upcoming:{item.Id}:{item.PlannedDate.Date.Ticks}")
            .ToList();
        var existing = (await dbContext.PerformanceNotifications
                .Where(notification => notification.DedupKey != null && candidateKeys.Contains(notification.DedupKey))
                .Select(notification => notification.DedupKey!)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        var newNotifications = new List<PerformanceNotification>();
        foreach (var item in upcoming)
        {
            var dedupKey = $"checkin-upcoming:{item.Id}:{item.PlannedDate.Date.Ticks}";
            if (existing.Contains(dedupKey))
                continue;
            newNotifications.Add(PerformanceNotification.Create(
                tenantId,
                item.EmployeeId,
                PerformanceNotificationType.CheckInReminder,
                title: "You have an upcoming check-in",
                message: $"Your check-in is scheduled for {item.PlannedDate:MMM d, yyyy}.",
                cycleId: item.CycleId,
                dedupKey: dedupKey,
                subjectType: "PerformanceCheckIn",
                subjectId: item.Id,
                navigationRoute: "/my-objectives"));
        }

        if (newNotifications.Count == 0)
            return 0;

        dbContext.PerformanceNotifications.AddRange(newNotifications);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} upcoming-check-in reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
        return newNotifications.Count;
    }
}
