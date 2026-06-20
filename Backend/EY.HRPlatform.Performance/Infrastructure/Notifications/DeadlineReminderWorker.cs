using System.Linq.Expressions;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

/// <summary>
/// Periodically materialises in-app deadline reminders (due-soon / overdue) for participants of
/// in-flight cycles. Runs outside any HTTP request, so it iterates tenants deliberately: it sets a
/// per-tenant context in a fresh DI scope so the global query filter and tenant interceptor apply,
/// and is idempotent via per-recipient dedup keys.
/// </summary>
public sealed class DeadlineReminderWorker(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<DeadlineReminderWorker> logger) : BackgroundService
{
    private static readonly Expression<Func<PerformanceCycle, bool>> InFlightWithDeadline =
        cycle => cycle.Status == PerformanceCycleStatus.Active
            && cycle.ObjectiveSettingDeadline != null;

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var settings = options.Value;
        if (!settings.Enabled)
        {
            logger.LogInformation("Deadline reminder worker disabled by configuration.");
            return;
        }

        // Small startup delay so migrations/seeding settle before the first sweep.
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(30), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        var interval = TimeSpan.FromMinutes(Math.Max(1, settings.SweepIntervalMinutes));
        using var timer = new PeriodicTimer(interval);

        do
        {
            try
            {
                await SweepAsync(settings, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Deadline reminder sweep failed.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    private async Task SweepAsync(ReminderOptions settings, CancellationToken cancellationToken)
    {
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

        foreach (var tenantId in tenantIds)
        {
            await ProcessTenantAsync(tenantId, settings, cancellationToken);
        }
    }

    private async Task ProcessTenantAsync(Guid tenantId, ReminderOptions settings, CancellationToken cancellationToken)
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
            return;
        }

        dbContext.PerformanceNotifications.AddRange(newNotifications);
        await dbContext.SaveChangesAsync(cancellationToken);
        logger.LogInformation(
            "Generated {Count} deadline reminder(s) for tenant {TenantId}.", newNotifications.Count, tenantId);
    }
}
