using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Infrastructure.Persistence;

namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

/// <summary>
/// Stages what a transition tells its recipients: the email (outbox) and the in-app notification,
/// in the transition's own unit of work so they commit or roll back with it.
/// </summary>
public interface IPerformanceNotifications
{
    void EnqueuePlan(EmployeePlan plan, PerformanceNotificationKind kind, string? actorDisplayName);
    void EnqueueReview(PerformanceReview review, PerformanceNotificationKind kind, string reviewRoundName);
    void EnqueueCalibrationReady(CalibrationSession session, string reviewRoundName);
    void EnqueueUpdateRequested(UpdateRequest request, string? objectiveTitle);
}

public sealed class PerformanceNotifications(PerformanceDbContext db) : IPerformanceNotifications
{
    public void EnqueuePlan(EmployeePlan plan, PerformanceNotificationKind kind, string? actorDisplayName)
    {
        var recipient = kind == PerformanceNotificationKind.PlanSubmitted ? plan.ResponsibleManagerId : plan.EmployeeId;
        if (recipient is not Guid employeeId || employeeId == Guid.Empty)
            throw new InvalidOperationException("The notification has no recorded recipient.");
        var transition = plan.Decisions.Last();
        var message = PerformanceOutboxMessage.ForPlan(plan.TenantId, kind, employeeId, plan.Id, transition.Id,
            new PlanNotificationPayload(plan.CycleId, plan.Id, actorDisplayName));
        Stage(message, null, PerformanceNotificationTemplates.ForPlan(plan, kind, actorDisplayName));
    }

    public void EnqueueReview(PerformanceReview review, PerformanceNotificationKind kind, string reviewRoundName)
    {
        var recipient = kind is PerformanceNotificationKind.SelfAssessmentOpened or PerformanceNotificationKind.ReviewFinalized
            ? review.SubjectEmployeeId : review.ReviewerEmployeeId;
        var message = PerformanceOutboxMessage.ForReview(review.TenantId, kind, recipient, review.Id, review.ReviewRoundId,
            new ReviewNotificationPayload(review.CycleId, review.ReviewRoundId, review.Id, reviewRoundName));
        Stage(message, null, PerformanceNotificationTemplates.ForReview(review, kind, reviewRoundName));
    }

    public void EnqueueCalibrationReady(CalibrationSession session, string reviewRoundName)
    {
        foreach (var facilitator in session.Facilitators)
        {
            var message = PerformanceOutboxMessage.ForCalibration(session.TenantId, facilitator.UserId, facilitator.EmployeeId,
                new CalibrationNotificationPayload(session.CycleId, session.ReviewRoundId, session.Id, reviewRoundName));
            Stage(message, facilitator.UserId, PerformanceNotificationTemplates.ForCalibrationReady(session, reviewRoundName));
        }
    }

    public void EnqueueUpdateRequested(UpdateRequest request, string? objectiveTitle)
    {
        var message = PerformanceOutboxMessage.ForPlan(request.TenantId, PerformanceNotificationKind.UpdateRequested, request.EmployeeId,
            request.PlanId, request.Id, new PlanNotificationPayload(request.CycleId, request.PlanId, request.RequestedByName));
        Stage(message, null, PerformanceNotificationTemplates.ForUpdateRequest(request, objectiveTitle));
    }

    /// <summary>
    /// State retries return before enqueue; this also protects repeated staging in the same context.
    /// Both rows share the outbox dedupe key, which is unique per tenant.
    /// </summary>
    private void Stage(PerformanceOutboxMessage message, Guid? recipientUserId, PerformanceNotificationText text)
    {
        if (db.OutboxMessages.Local.Any(m => m.TenantId == message.TenantId && m.DedupeKey == message.DedupeKey)) return;
        db.OutboxMessages.Add(message);
        db.Notifications.Add(PerformanceNotification.For(message, recipientUserId, text, DateTime.UtcNow));
    }
}
