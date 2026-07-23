using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Infrastructure.Jobs;

public sealed class EvaluationDeadlineReminderJob(
    IServiceProvider services,
    IOptions<ReminderOptions> options,
    ILogger<EvaluationDeadlineReminderJob> logger) : IScheduledJob
{
    public string Name => "evaluation-deadline-reminders";
    public TimeSpan Interval => options.Value.Enabled
        ? TimeSpan.FromMinutes(Math.Max(1, options.Value.SweepIntervalMinutes))
        : TimeSpan.Zero;

    public async Task<int> ExecuteAsync(CancellationToken cancellationToken)
    {
        List<Guid> tenantIds;
        using (var scope = services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
            tenantIds = await db.EvaluationRounds.IgnoreQueryFilters().AsNoTracking()
                .Where(x => x.Status == EvaluationRoundStatus.Launched)
                .Select(x => x.TenantId).Distinct().ToListAsync(cancellationToken);
        }

        var total = 0;
        foreach (var tenantId in tenantIds)
            total += await ProcessTenantAsync(tenantId, cancellationToken);
        return total;
    }

    private async Task<int> ProcessTenantAsync(Guid tenantId, CancellationToken ct)
    {
        using var scope = services.CreateScope();
        scope.ServiceProvider.GetRequiredService<TenantContext>().SetTenant(tenantId);
        var db = scope.ServiceProvider.GetRequiredService<PerformanceDbContext>();
        var now = DateTime.UtcNow;
        var dueSoonAt = now.AddDays(options.Value.DueSoonWindowDays);
        var rounds = await db.EvaluationRounds.AsNoTracking()
            .Where(x => x.Status == EvaluationRoundStatus.Launched)
            .ToListAsync(ct);
        var roundIds = rounds.Select(x => x.Id).ToArray();
        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(x => roundIds.Contains(x.RoundId) && x.Status != EvaluationAssignmentStatus.Finalized)
            .ToListAsync(ct);
        // Preload existing reminder dedup keys once per sweep instead of probing the database per
        // assignment; the unique (TenantId, DedupKey) index remains the concurrency safety net.
        var existingKeys = (await db.PerformanceNotifications.AsNoTracking()
                .Where(x => x.DedupKey != null && x.DedupKey.StartsWith("evaluation-deadline:"))
                .Select(x => x.DedupKey!)
                .ToListAsync(ct))
            .ToHashSet(StringComparer.Ordinal);
        var notifications = new List<PerformanceNotification>();

        foreach (var round in rounds)
        {
            var deadlines = new[]
            {
                (Kind: EvaluationAssignmentKind.SelfAssessment, Deadline: round.SelfAssessmentDeadline),
                (Kind: EvaluationAssignmentKind.ManagerAssessment, Deadline: round.ManagerAssessmentDeadline)
            };
            foreach (var item in deadlines.Where(x => x.Deadline.HasValue && x.Deadline.Value <= dueSoonAt))
            {
                var overdue = item.Deadline!.Value < now;
                var type = overdue ? PerformanceNotificationType.EvaluationDeadlineOverdue : PerformanceNotificationType.EvaluationDeadlineDueSoon;
                foreach (var assignment in assignments.Where(x => x.RoundId == round.Id && x.Kind == item.Kind))
                {
                    var key = $"evaluation-deadline:{round.Id}:{item.Kind}:{type}:{item.Deadline.Value.Ticks}:{assignment.Id}";
                    if (!existingKeys.Add(key)) continue;
                    notifications.Add(PerformanceNotification.Create(
                        tenantId, assignment.AssigneeEmployeeId, type,
                        overdue ? "Evaluation deadline overdue" : "Evaluation deadline approaching",
                        $"{round.Name} is due {item.Deadline.Value:MMM d, yyyy}.",
                        round.PerformanceCycleId, key, "EvaluationAssignment", assignment.Id,
                        item.Kind == EvaluationAssignmentKind.SelfAssessment ? "/my-evaluations" : "/team-evaluations"));
                }
            }
        }

        if (notifications.Count == 0) return 0;
        db.PerformanceNotifications.AddRange(notifications);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Generated {Count} evaluation reminder(s) for tenant {TenantId}.", notifications.Count, tenantId);
        return notifications.Count;
    }
}
