using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Features.Notifications.Handlers;

public sealed class EvaluationRoundLaunchedActivityHandler(IActivityLog activity, PerformanceDbContext db)
    : INotificationHandler<EvaluationRoundLaunchedEvent>
{
    public async Task Handle(EvaluationRoundLaunchedEvent e, CancellationToken ct)
    {
        activity.Record("EvaluationRoundLaunched", "EvaluationRound", e.RoundId,
            new { e.CampaignId, ParticipantCount = e.Recipients.Count, e.SelfAssessmentDeadline, e.ManagerAssessmentDeadline });
        await db.SaveChangesAsync(ct);
    }
}

public sealed class EvaluationRoundLaunchedNotificationHandler(
    IPerformanceNotifier notifier,
    PerformanceDbContext db) : INotificationHandler<EvaluationRoundLaunchedEvent>
{
    public async Task Handle(EvaluationRoundLaunchedEvent e, CancellationToken ct)
    {
        var assignments = await db.EvaluationAssignments.AsNoTracking()
            .Where(x => x.RoundId == e.RoundId)
            .ToListAsync(ct);
        foreach (var assignment in assignments)
        {
            var self = assignment.Kind == EvaluationAssignmentKind.SelfAssessment;
            await notifier.NotifyAsync(
                assignment.AssigneeEmployeeId,
                PerformanceNotificationType.EvaluationLaunched,
                self ? "Your evaluation is ready" : "A team evaluation is ready",
                self
                    ? $"{e.RoundName} is open for your self-assessment."
                    : $"{e.RoundName} is open for {assignment.ParticipantName}.",
                e.CampaignId,
                "EvaluationAssignment",
                assignment.Id,
                self ? $"/my-evaluations?assignment={assignment.Id}" : $"/team-evaluations?assignment={assignment.Id}",
                $"evaluation-launched:{assignment.Id}",
                ct);
        }
    }
}

public sealed class EvaluationRoundDeadlineExtendedActivityHandler(IActivityLog activity, PerformanceDbContext db)
    : INotificationHandler<EvaluationRoundDeadlineExtendedEvent>
{
    public async Task Handle(EvaluationRoundDeadlineExtendedEvent e, CancellationToken ct)
    {
        activity.Record("EvaluationRoundDeadlineExtended", "EvaluationRound", e.RoundId,
            new { e.CampaignId, e.DeadlineKind, e.PreviousDeadline, e.NewDeadline, e.Reason });
        await db.SaveChangesAsync(ct);
    }
}

public sealed class EvaluationRoundDeadlineExtendedNotificationHandler(
    IPerformanceNotifier notifier,
    PerformanceDbContext db) : INotificationHandler<EvaluationRoundDeadlineExtendedEvent>
{
    public async Task Handle(EvaluationRoundDeadlineExtendedEvent e, CancellationToken ct)
    {
        var source = db.EvaluationAssignments.AsNoTracking().Where(x => x.RoundId == e.RoundId);
        if (e.DeadlineKind == EvaluationDeadlineKind.SelfAssessment)
            source = source.Where(x => x.Kind == EvaluationAssignmentKind.SelfAssessment);
        else if (e.DeadlineKind == EvaluationDeadlineKind.ManagerAssessment)
            source = source.Where(x => x.Kind == EvaluationAssignmentKind.ManagerAssessment);

        var assignments = await source.ToListAsync(ct);
        foreach (var assignment in assignments.GroupBy(x => x.AssigneeEmployeeId).Select(x => x.First()))
        {
            var self = assignment.Kind == EvaluationAssignmentKind.SelfAssessment;
            await notifier.NotifyAsync(
                assignment.AssigneeEmployeeId,
                PerformanceNotificationType.EvaluationDeadlineExtended,
                "Evaluation deadline extended",
                $"The {e.DeadlineKind.ToString().Replace("Assessment", " assessment").ToLowerInvariant()} deadline for {e.RoundName} is now {e.NewDeadline:MMM d, yyyy}.",
                e.CampaignId,
                "EvaluationRound",
                e.RoundId,
                self ? "/my-evaluations" : "/team-evaluations",
                $"evaluation-deadline-extended:{e.RoundId}:{e.DeadlineKind}:{e.NewDeadline.Ticks}:{assignment.AssigneeEmployeeId}",
                ct);
        }
    }
}
