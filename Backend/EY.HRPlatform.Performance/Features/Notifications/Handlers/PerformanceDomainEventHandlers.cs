using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using MediatR;

namespace EY.HRPlatform.Performance.Features.Notifications.Handlers;

// These handlers run post-commit (see DomainEventDispatchInterceptor). Each is its own unit of work
// and is duplicate-tolerant: activity is naturally idempotent enough for this tier, and notifications
// are deduped by key. A single business action fans out to independent handlers without the
// originating command referencing them.

/// <summary>Records the shared activity entry when a plan is submitted.</summary>
public sealed class PlanSubmittedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<EmployeeObjectivePlanSubmittedEvent>
{
    public async Task Handle(EmployeeObjectivePlanSubmittedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: notification.WasResubmission ? "PlanResubmitted" : "PlanSubmitted",
            subjectType: "EmployeeObjectivePlan",
            subjectId: notification.PlanId,
            metadata: new { notification.CycleId, notification.EmployeeId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>Notifies the approving manager when a plan is submitted for their review.</summary>
public sealed class PlanSubmittedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<EmployeeObjectivePlanSubmittedEvent>
{
    public Task Handle(EmployeeObjectivePlanSubmittedEvent notification, CancellationToken cancellationToken)
    {
        if (notification.ApproverEmployeeId is not { } approver)
        {
            return Task.CompletedTask;
        }

        return notifier.NotifyAsync(
            approver,
            PerformanceNotificationType.PlanSubmitted,
            title: "An objective plan is ready for your review",
            message: $"{notification.EmployeeName} submitted their objective plan for approval.",
            cycleId: notification.CycleId,
            subjectType: "EmployeeObjectivePlan",
            subjectId: notification.PlanId,
            navigationRoute: "/plan-approvals",
            dedupKey: $"plan-submitted:{notification.PlanId}:{notification.EventId}",
            cancellationToken: cancellationToken);
    }
}

/// <summary>Records the shared activity entry when a plan is approved.</summary>
public sealed class PlanApprovedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<EmployeeObjectivePlanApprovedEvent>
{
    public async Task Handle(EmployeeObjectivePlanApprovedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "PlanApproved",
            subjectType: "EmployeeObjectivePlan",
            subjectId: notification.PlanId,
            metadata: new { notification.CycleId, notification.EmployeeId, notification.ApprovingManagerEmployeeId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>Notifies the plan owner when their plan is approved.</summary>
public sealed class PlanApprovedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<EmployeeObjectivePlanApprovedEvent>
{
    public Task Handle(EmployeeObjectivePlanApprovedEvent notification, CancellationToken cancellationToken)
        => notifier.NotifyAsync(
            notification.EmployeeId,
            PerformanceNotificationType.PlanApproved,
            title: "Your objective plan was approved",
            message: $"{notification.ApprovingManagerName} approved your objective plan.",
            cycleId: notification.CycleId,
            subjectType: "EmployeeObjectivePlan",
            subjectId: notification.PlanId,
            navigationRoute: "/my-objectives",
            dedupKey: $"plan-approved:{notification.PlanId}:{notification.EventId}",
            cancellationToken: cancellationToken);
}

/// <summary>Records the shared activity entry when a cycle is closed.</summary>
public sealed class PerformanceCycleClosedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<PerformanceCycleClosedEvent>
{
    public async Task Handle(PerformanceCycleClosedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CycleClosed",
            subjectType: "PerformanceCycle",
            subjectId: notification.CycleId,
            metadata: new { notification.CycleName });
        await db.SaveChangesAsync(cancellationToken);
    }
}
