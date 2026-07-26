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

        void AddReminders(
            EvaluationRound round, DateTime? deadline, string deadlineKind,
            IEnumerable<EvaluationAssignment> eligible, string route)
        {
            if (!deadline.HasValue || deadline.Value > dueSoonAt) return;
            var overdue = deadline.Value < now;
            var type = overdue ? PerformanceNotificationType.EvaluationDeadlineOverdue : PerformanceNotificationType.EvaluationDeadlineDueSoon;
            foreach (var assignment in eligible)
            {
                // Dedup key is (assignment, deadlineKind, window) so each deadline reminds once per window.
                var key = $"evaluation-deadline:{round.Id}:{deadlineKind}:{type}:{deadline.Value.Ticks}:{assignment.Id}";
                if (!existingKeys.Add(key)) continue;
                notifications.Add(PerformanceNotification.Create(
                    tenantId, assignment.AssigneeEmployeeId, type,
                    overdue ? "Evaluation deadline overdue" : "Evaluation deadline approaching",
                    $"{round.Name} ({deadlineKind.ToLowerInvariant()}) is due {deadline.Value:MMM d, yyyy}.",
                    round.PerformanceCycleId, key, "EvaluationAssignment", assignment.Id, route));
            }
        }

        foreach (var round in rounds)
        {
            var forRound = assignments.Where(a => a.RoundId == round.Id).ToArray();

            // Self: only while the participant's self-assessment is still open (never submitted/finalized).
            AddReminders(round, round.SelfAssessmentDeadline, "Self",
                forRound.Where(a => a.Kind == EvaluationAssignmentKind.SelfAssessment
                    && a.Status is EvaluationAssignmentStatus.NotStarted or EvaluationAssignmentStatus.InProgress),
                "/my-evaluations");

            // Manager: only while the reviewer's assessment is still open.
            AddReminders(round, round.ManagerAssessmentDeadline, "Manager",
                forRound.Where(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment
                    && a.Status is EvaluationAssignmentStatus.NotStarted or EvaluationAssignmentStatus.InProgress),
                "/team-evaluations");

            // Finalization: the reviewer, while the evaluation is not yet finalized.
            AddReminders(round, round.FinalizationDeadline, "Finalization",
                forRound.Where(a => a.Kind == EvaluationAssignmentKind.ManagerAssessment
                    && a.Status != EvaluationAssignmentStatus.Finalized),
                "/team-evaluations");
        }

        if (notifications.Count == 0) return 0;
        db.PerformanceNotifications.AddRange(notifications);
        await db.SaveChangesAsync(ct);
        logger.LogInformation("Generated {Count} evaluation reminder(s) for tenant {TenantId}.", notifications.Count, tenantId);
        return notifications.Count;
    }
}
