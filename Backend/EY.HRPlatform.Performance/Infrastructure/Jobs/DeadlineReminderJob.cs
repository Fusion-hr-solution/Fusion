using System.Linq.Expressions;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

/// <summary>
/// Materialises due-soon and overdue objective-setting reminders for participants of in-flight
/// cycles. Extracted from the former <c>DeadlineReminderWorker</c> and hosted under
/// <see cref="ScheduledJobRunner"/>; idempotent via per-recipient dedup keys.
/// </summary>
public sealed class DeadlineReminderJob(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<DeadlineReminderJob> logger) : IScheduledJob
{
    private static readonly Expression<Func<PerformanceCycle, bool>> InFlightWithDeadline =
        cycle => cycle.Status == PerformanceCycleStatus.Active
            && cycle.ObjectiveSettingDeadline != null;

    public string Name => "deadline-reminders";

    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.SweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        var settings = options.Value;
        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await dbContext.PerformanceCycles
                .IgnoreQueryFilters()
                .Where(InFlightWithDeadline)
                .Select(c => c.TenantId)
                .Distinct()
                .ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
        {
            total += await ProcessTenantAsync(tenantId, settings, cancellationToken);
        }

        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, ReminderOptions settings, CancellationToken cancellationToken)
    {
        using var scope = services.CreateScope();
        var tenantContext = scope.ServiceProvider.GetRequiredService<TenantContext>();
        tenantContext.SetTenant(tenantId);

        var dbContext = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var now = DateTime.UtcNow;

        var cycles = await dbContext.PerformanceCycles
            .Include(c => c.Participants)
            .Where(InFlightWithDeadline)
            .ToListAsync(cancellationToken);

        var newNotifications = new List<PerformanceNotification>();

        foreach (var cycle in cycles)
        {
            var state = CycleDeadline.Evaluate(cycle, now, settings.DueSoonWindowDays);
            if (state is not (CycleDeadline.DueSoon or CycleDeadline.Overdue))
            {
                continue;
            }

            var type = state == CycleDeadline.Overdue
                ? PerformanceNotificationType.DeadlineOverdue
                : PerformanceNotificationType.DeadlineDueSoon;
            var deadline = cycle.ObjectiveSettingDeadline!.Value;

            var candidates = cycle.Participants
                .Select(p => (p.EmployeeId, DedupKey: $"{cycle.Id}:{type}:{p.EmployeeId}:{deadline.Ticks}"))
                .ToList();
            if (candidates.Count == 0)
            {
                continue;
            }

            var candidateKeys = candidates.Select(c => c.DedupKey).ToList();
            var existingKeys = await dbContext.PerformanceNotifications
                .Where(n => n.DedupKey != null && candidateKeys.Contains(n.DedupKey))
                .Select(n => n.DedupKey!)
                .ToListAsync(cancellationToken);
            var existingSet = existingKeys.ToHashSet(StringComparer.Ordinal);

            foreach (var candidate in candidates.Where(c => !existingSet.Contains(c.DedupKey)))
            {
                newNotifications.Add(CycleNotificationFactory.ForDeadline(cycle, candidate.EmployeeId, type, deadline));
            }
        }

        if (newNotifications.Count == 0)
        {
            return 0;
        }

        dbContext.PerformanceNotifications.AddRange(newNotifications);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} deadline reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
        return newNotifications.Count;
    }
}
