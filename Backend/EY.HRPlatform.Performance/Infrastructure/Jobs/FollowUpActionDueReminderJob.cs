using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Reminds a follow-up action's owner as its due date approaches or passes while the action is still
/// Open. Idempotent per action and due-date bucket, so repeated ticks never re-notify for the same
/// due date; a later due date (were one ever set) would advance the bucket. Never mutates action state.
/// </summary>
public sealed class FollowUpActionDueReminderJob(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<FollowUpActionDueReminderJob> logger) : IScheduledJob
{
    public string Name => "followup-action-due-reminders";

    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.SweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        var windowDays = Math.Max(1, options.Value.FollowUpActionDueWindowDays);
        var now = DateTime.UtcNow;
        var horizon = now.AddDays(windowDays);

        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await dbContext.CheckInFollowUpActions
                .IgnoreQueryFilters()
                .Where(action => action.Status == FollowUpActionStatus.Open && action.DueDate <= horizon)
                .Select(action => action.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
            total += await ProcessTenantAsync(tenantId, horizon, cancellationToken);
        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, DateTime horizon, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();

        var due = await dbContext.CheckInFollowUpActions
            .AsNoTracking()
            .Where(action => action.Status == FollowUpActionStatus.Open && action.DueDate <= horizon)
            .Select(action => new { action.Id, action.OwnerEmployeeId, action.CycleId, action.CheckInId, action.Description, action.DueDate })
            .ToListAsync(cancellationToken);
        if (due.Count == 0)
            return 0;

        var candidateKeys = due.Select(item => $"action-due:{item.Id}:{item.DueDate.Date.Ticks}").ToList();
        var existing = (await dbContext.PerformanceNotifications
                .Where(notification => notification.DedupKey != null && candidateKeys.Contains(notification.DedupKey))
                .Select(notification => notification.DedupKey!)
                .ToListAsync(cancellationToken))
            .ToHashSet(StringComparer.Ordinal);

        var newNotifications = new List<PerformanceNotification>();
        foreach (var item in due)
        {
            var dedupKey = $"action-due:{item.Id}:{item.DueDate.Date.Ticks}";
            if (existing.Contains(dedupKey))
                continue;
            newNotifications.Add(PerformanceNotification.Create(
                tenantId,
                item.OwnerEmployeeId,
                PerformanceNotificationType.FollowUpActionDueSoon,
                title: "A follow-up action is due",
                message: $"\"{item.Description}\" is due {item.DueDate:MMM d, yyyy}.",
                cycleId: item.CycleId,
                dedupKey: dedupKey,
                subjectType: "CheckInFollowUpAction",
                subjectId: item.Id,
                navigationRoute: "/my-objectives"));
        }

        if (newNotifications.Count == 0)
            return 0;

        dbContext.PerformanceNotifications.AddRange(newNotifications);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} follow-up-action due reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
        return newNotifications.Count;
    }
}
