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
                self
                    ? $"/my-evaluations/{e.RoundId}"
                    : $"/team-evaluations/{e.RoundId}/{assignment.ParticipantEmployeeId}",
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

// ─── Assessment workflow notifications (post-commit) ─────────────────────────

public sealed class EvaluationSelfAssessmentSubmittedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<EvaluationSelfAssessmentSubmittedEvent>
{
    public Task Handle(EvaluationSelfAssessmentSubmittedEvent e, CancellationToken ct) =>
        notifier.NotifyAsync(
            e.ReviewerEmployeeId,
            PerformanceNotificationType.EvaluationSelfAssessmentSubmitted,
            "Self-assessment submitted",
            $"{e.ParticipantName} submitted their self-assessment.",
            null, "EvaluationAssignment", e.SelfAssignmentId,
            $"/team-evaluations/{e.RoundId}/{e.ParticipantEmployeeId}",
            $"evaluation-self-submitted:{e.SelfAssignmentId}", ct);
}

public sealed class EvaluationSelfAssessmentReopenedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<EvaluationSelfAssessmentReopenedEvent>
{
    public Task Handle(EvaluationSelfAssessmentReopenedEvent e, CancellationToken ct) =>
        notifier.NotifyAsync(
            e.ParticipantEmployeeId,
            PerformanceNotificationType.EvaluationSelfAssessmentReopened,
            "Self-assessment reopened",
            $"Your self-assessment was reopened for revision. Reason: {e.Reason}",
            null, "EvaluationAssignment", e.SelfAssignmentId,
            $"/my-evaluations/{e.RoundId}",
            $"evaluation-self-reopened:{e.SelfAssignmentId}:{e.OccurredOn.Ticks}", ct);
}

public sealed class EvaluationFinalizedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<EvaluationFinalizedEvent>
{
    public Task Handle(EvaluationFinalizedEvent e, CancellationToken ct) =>
        notifier.NotifyAsync(
            e.ParticipantEmployeeId,
            PerformanceNotificationType.EvaluationFinalized,
            "Your evaluation is finalized",
            "Your evaluation is complete and ready for you to review and acknowledge.",
            null, "EvaluationAssignment", e.ManagerAssignmentId,
            $"/my-evaluations/{e.RoundId}",
            $"evaluation-finalized:{e.ManagerAssignmentId}", ct);
}

public sealed class EvaluationAcknowledgedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<EvaluationAcknowledgedEvent>
{
    public Task Handle(EvaluationAcknowledgedEvent e, CancellationToken ct) =>
        notifier.NotifyAsync(
            e.ReviewerEmployeeId,
            PerformanceNotificationType.EvaluationAcknowledged,
            "Evaluation acknowledged",
            $"{e.ParticipantName} acknowledged their finalized evaluation.",
            null, "EvaluationAssignment", e.ManagerAssignmentId,
            $"/team-evaluations/{e.RoundId}/{e.ParticipantEmployeeId}",
            $"evaluation-acknowledged:{e.ManagerAssignmentId}", ct);
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
                self
                    ? $"/my-evaluations/{e.RoundId}"
                    : $"/team-evaluations/{e.RoundId}/{assignment.ParticipantEmployeeId}",
                $"evaluation-deadline-extended:{e.RoundId}:{e.DeadlineKind}:{e.NewDeadline.Ticks}:{assignment.AssigneeEmployeeId}",
                ct);
        }
    }
}
