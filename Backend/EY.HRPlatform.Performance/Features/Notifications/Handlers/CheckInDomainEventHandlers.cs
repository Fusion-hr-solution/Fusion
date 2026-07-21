using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Domain.Events;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using MediatR;

namespace EY.HRPlatform.Performance.Features.Notifications.Handlers;

// Post-commit handlers for the check-in / follow-up / discussion-signal lifecycle. Each is its own
// unit of work and duplicate-tolerant: activity is append-only, notifications are deduped by key.
// The employee is notified of check-in lifecycle changes; the owner is notified of action
// assignment; the effective reviewer is notified of a raised discussion signal.

internal static class CheckInRoutes
{
    public const string EmployeeSurface = "/my-objectives";
    public const string TeamProgress = "/team-progress";

    public static string CheckInDetail(Guid cycleId, Guid checkInId)
        => $"/team-progress/{cycleId}/check-ins/{checkInId}";
}

// ─── Check-in lifecycle ─────────────────────────────────────────────────────

public sealed class CheckInPlannedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<CheckInPlannedEvent>
{
    public async Task Handle(CheckInPlannedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CheckInPlanned",
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            metadata: new { notification.CycleId, notification.EmployeeId, notification.ReviewerId, notification.PlannedDate });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CheckInPlannedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<CheckInPlannedEvent>
{
    public Task Handle(CheckInPlannedEvent notification, CancellationToken cancellationToken)
        => notifier.NotifyAsync(
            notification.EmployeeId,
            PerformanceNotificationType.CheckInPlanned,
            title: "A check-in has been planned",
            message: $"{notification.ReviewerName} planned a check-in with you for {notification.PlannedDate:MMM d, yyyy}.",
            cycleId: notification.CycleId,
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            navigationRoute: CheckInRoutes.EmployeeSurface,
            dedupKey: $"checkin-planned:{notification.CheckInId}:{notification.EventId}",
            cancellationToken: cancellationToken);
}

public sealed class CheckInRescheduledActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<CheckInRescheduledEvent>
{
    public async Task Handle(CheckInRescheduledEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CheckInRescheduled",
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            metadata: new { notification.CycleId, notification.EmployeeId, notification.PreviousDate, notification.NewDate });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CheckInRescheduledNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<CheckInRescheduledEvent>
{
    public Task Handle(CheckInRescheduledEvent notification, CancellationToken cancellationToken)
        => notifier.NotifyAsync(
            notification.EmployeeId,
            PerformanceNotificationType.CheckInRescheduled,
            title: "Your check-in was rescheduled",
            message: $"{notification.ReviewerName} moved your check-in to {notification.NewDate:MMM d, yyyy}.",
            cycleId: notification.CycleId,
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            navigationRoute: CheckInRoutes.EmployeeSurface,
            dedupKey: $"checkin-rescheduled:{notification.CheckInId}:{notification.EventId}",
            cancellationToken: cancellationToken);
}

public sealed class CheckInCancelledActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<CheckInCancelledEvent>
{
    public async Task Handle(CheckInCancelledEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CheckInCancelled",
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            metadata: new { notification.CycleId, notification.EmployeeId, notification.Reason });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CheckInCancelledNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<CheckInCancelledEvent>
{
    public Task Handle(CheckInCancelledEvent notification, CancellationToken cancellationToken)
        => notifier.NotifyAsync(
            notification.EmployeeId,
            PerformanceNotificationType.CheckInCancelled,
            title: "Your check-in was cancelled",
            message: $"{notification.ReviewerName} cancelled a planned check-in.",
            cycleId: notification.CycleId,
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            navigationRoute: CheckInRoutes.EmployeeSurface,
            dedupKey: $"checkin-cancelled:{notification.CheckInId}:{notification.EventId}",
            cancellationToken: cancellationToken);
}

public sealed class CheckInCompletedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<CheckInCompletedEvent>
{
    public async Task Handle(CheckInCompletedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CheckInCompleted",
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            metadata: new { notification.CycleId, notification.EmployeeId, notification.CompletedByReviewerId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CheckInCompletedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<CheckInCompletedEvent>
{
    public Task Handle(CheckInCompletedEvent notification, CancellationToken cancellationToken)
        => notifier.NotifyAsync(
            notification.EmployeeId,
            PerformanceNotificationType.CheckInCompleted,
            title: "Your check-in was completed",
            message: $"{notification.CompletedByReviewerName} recorded the outcome of your check-in.",
            cycleId: notification.CycleId,
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            navigationRoute: CheckInRoutes.EmployeeSurface,
            dedupKey: $"checkin-completed:{notification.CheckInId}:{notification.EventId}",
            cancellationToken: cancellationToken);
}

public sealed class CheckInAddendumActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<CheckInAddendumAddedEvent>
{
    public async Task Handle(CheckInAddendumAddedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CheckInAddendumAdded",
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            metadata: new { notification.CycleId, notification.EmployeeId, notification.AuthorReviewerId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class CheckInResponseActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<CheckInResponseAddedEvent>
{
    public async Task Handle(CheckInResponseAddedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "CheckInResponseAdded",
            subjectType: "PerformanceCheckIn",
            subjectId: notification.CheckInId,
            metadata: new { notification.CycleId, notification.EmployeeId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

// ─── Follow-up actions ──────────────────────────────────────────────────────

public sealed class FollowUpActionCreatedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<FollowUpActionCreatedEvent>
{
    public async Task Handle(FollowUpActionCreatedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "FollowUpActionCreated",
            subjectType: "CheckInFollowUpAction",
            subjectId: notification.ActionId,
            metadata: new { notification.CheckInId, notification.CycleId, notification.EmployeeId, notification.OwnerKind, notification.OwnerEmployeeId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class FollowUpActionAssignedNotificationHandler(IPerformanceNotifier notifier)
    : INotificationHandler<FollowUpActionCreatedEvent>
{
    public Task Handle(FollowUpActionCreatedEvent notification, CancellationToken cancellationToken)
    {
        var route = notification.OwnerKind == FollowUpActionOwnerKind.Employee
            ? CheckInRoutes.EmployeeSurface
            : CheckInRoutes.CheckInDetail(notification.CycleId, notification.CheckInId);

        return notifier.NotifyAsync(
            notification.OwnerEmployeeId,
            PerformanceNotificationType.FollowUpActionAssigned,
            title: "A follow-up action was assigned to you",
            message: $"\"{notification.Description}\" is due {notification.DueDate:MMM d, yyyy}.",
            cycleId: notification.CycleId,
            subjectType: "CheckInFollowUpAction",
            subjectId: notification.ActionId,
            navigationRoute: route,
            dedupKey: $"action-assigned:{notification.ActionId}:{notification.EventId}",
            cancellationToken: cancellationToken);
    }
}

public sealed class FollowUpActionCompletedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<FollowUpActionCompletedEvent>
{
    public async Task Handle(FollowUpActionCompletedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "FollowUpActionCompleted",
            subjectType: "CheckInFollowUpAction",
            subjectId: notification.ActionId,
            metadata: new { notification.CheckInId, notification.CycleId, notification.EmployeeId, notification.OwnerEmployeeId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class FollowUpActionCancelledActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<FollowUpActionCancelledEvent>
{
    public async Task Handle(FollowUpActionCancelledEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "FollowUpActionCancelled",
            subjectType: "CheckInFollowUpAction",
            subjectId: notification.ActionId,
            metadata: new { notification.CheckInId, notification.CycleId, notification.EmployeeId, notification.Reason });
        await db.SaveChangesAsync(cancellationToken);
    }
}

// ─── Discussion signals ─────────────────────────────────────────────────────

public sealed class DiscussionSignalRaisedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<DiscussionSignalRaisedEvent>
{
    public async Task Handle(DiscussionSignalRaisedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "DiscussionSignalRaised",
            subjectType: "ObjectiveDiscussionSignal",
            subjectId: notification.SignalId,
            metadata: new { notification.CycleId, notification.ObjectiveId, notification.EmployeeId, notification.ObjectiveTitle });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DiscussionSignalRaisedNotificationHandler(
    IPerformanceNotifier notifier,
    EffectiveReviewerResolver reviewerResolver)
    : INotificationHandler<DiscussionSignalRaisedEvent>
{
    public async Task Handle(DiscussionSignalRaisedEvent notification, CancellationToken cancellationToken)
    {
        var reviewer = await reviewerResolver.ResolveForParticipantAsync(
            notification.CycleId, notification.EmployeeId, cancellationToken);
        if (reviewer is not { } reviewerId)
            return;

        await notifier.NotifyAsync(
            reviewerId,
            PerformanceNotificationType.DiscussionSignalRaised,
            title: "An employee flagged an objective for discussion",
            message: $"{notification.EmployeeName} wants to discuss \"{notification.ObjectiveTitle}\".",
            cycleId: notification.CycleId,
            subjectType: "ObjectiveDiscussionSignal",
            subjectId: notification.SignalId,
            navigationRoute: CheckInRoutes.TeamProgress,
            dedupKey: $"signal-raised:{notification.SignalId}:{notification.EventId}",
            cancellationToken: cancellationToken);
    }
}

public sealed class DiscussionSignalResolvedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<DiscussionSignalResolvedEvent>
{
    public async Task Handle(DiscussionSignalResolvedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "DiscussionSignalResolved",
            subjectType: "ObjectiveDiscussionSignal",
            subjectId: notification.SignalId,
            metadata: new { notification.CycleId, notification.ObjectiveId, notification.EmployeeId, notification.CheckInId });
        await db.SaveChangesAsync(cancellationToken);
    }
}

public sealed class DiscussionSignalClosedActivityHandler(IActivityLog activityLog, PerformanceDbContext db)
    : INotificationHandler<DiscussionSignalClosedEvent>
{
    public async Task Handle(DiscussionSignalClosedEvent notification, CancellationToken cancellationToken)
    {
        activityLog.Record(
            action: "DiscussionSignalClosed",
            subjectType: "ObjectiveDiscussionSignal",
            subjectId: notification.SignalId,
            metadata: new { notification.CycleId, notification.ObjectiveId, notification.EmployeeId, notification.Reason });
        await db.SaveChangesAsync(cancellationToken);
    }
}
