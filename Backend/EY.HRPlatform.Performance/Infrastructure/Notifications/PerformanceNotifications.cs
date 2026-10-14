using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;
using EY.HRPlatform.Performance.Infrastructure.Persistence;

namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

public interface IPerformanceNotifications
{
    void EnqueuePlan(EmployeePlan plan, PerformanceNotificationKind kind, string? actorDisplayName);
    void EnqueueReview(PerformanceReview review, PerformanceNotificationKind kind, string reviewRoundName);
    void EnqueueCalibrationReady(CalibrationSession session, string reviewRoundName);
    void EnqueueUpdateRequested(UpdateRequest request);
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
        // State retries return before enqueue. Also protect repeated staging in the same context.
        if (!db.OutboxMessages.Local.Any(m => m.TenantId == message.TenantId && m.DedupeKey == message.DedupeKey))
            db.OutboxMessages.Add(message);
    }

    public void EnqueueReview(PerformanceReview review, PerformanceNotificationKind kind, string reviewRoundName)
    {
        var recipient = kind is PerformanceNotificationKind.SelfAssessmentOpened or PerformanceNotificationKind.ReviewFinalized
            ? review.SubjectEmployeeId : review.ReviewerEmployeeId;
        var message = PerformanceOutboxMessage.ForReview(review.TenantId, kind, recipient, review.Id, review.ReviewRoundId,
            new ReviewNotificationPayload(review.CycleId, review.ReviewRoundId, review.Id, reviewRoundName));
        if (!db.OutboxMessages.Local.Any(m => m.TenantId == message.TenantId && m.DedupeKey == message.DedupeKey))
            db.OutboxMessages.Add(message);
    }

    public void EnqueueCalibrationReady(CalibrationSession session, string reviewRoundName)
    {
        foreach (var facilitator in session.Facilitators)
        {
            var message = PerformanceOutboxMessage.ForCalibration(session.TenantId, facilitator.UserId, facilitator.EmployeeId,
                new CalibrationNotificationPayload(session.CycleId, session.ReviewRoundId, session.Id, reviewRoundName));
            if (!db.OutboxMessages.Local.Any(m => m.TenantId == message.TenantId && m.DedupeKey == message.DedupeKey))
                db.OutboxMessages.Add(message);
        }
    }

    public void EnqueueUpdateRequested(UpdateRequest request)
    {
        var message = PerformanceOutboxMessage.ForPlan(request.TenantId, PerformanceNotificationKind.UpdateRequested, request.EmployeeId,
            request.PlanId, request.Id, new PlanNotificationPayload(request.CycleId, request.PlanId, request.RequestedByName));
        if (!db.OutboxMessages.Local.Any(m => m.TenantId == message.TenantId && m.DedupeKey == message.DedupeKey))
            db.OutboxMessages.Add(message);
    }
}
