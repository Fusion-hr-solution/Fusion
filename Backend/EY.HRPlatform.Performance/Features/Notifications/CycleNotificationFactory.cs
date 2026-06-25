using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Features.Notifications;

/// <summary>
/// Builds in-app notification entities for cycle lifecycle events and deadline reminders.
/// Dedup keys make generation idempotent (one per participant per cycle/type[/deadline]).
/// </summary>
public static class CycleNotificationFactory
{
    public static IReadOnlyList<PerformanceNotification> ForLifecycle(
        PerformanceCycle cycle,
        PerformanceNotificationType type,
        IEnumerable<Guid> recipientEmployeeIds)
    {
        var (title, message) = DescribeLifecycle(cycle, type);

        return recipientEmployeeIds
            .Distinct()
            .Select(employeeId => PerformanceNotification.Create(
                cycle.TenantId,
                employeeId,
                type,
                title,
                message,
                cycle.Id,
                dedupKey: $"{cycle.Id}:{type}:{employeeId}"))
            .ToList();
    }

    public static PerformanceNotification ForDeadline(
        PerformanceCycle cycle,
        Guid recipientEmployeeId,
        PerformanceNotificationType type,
        DateTime deadlineUtc)
    {
        var (title, message) = DescribeDeadline(cycle, type, deadlineUtc);
        return PerformanceNotification.Create(
            cycle.TenantId,
            recipientEmployeeId,
            type,
            title,
            message,
            cycle.Id,
            dedupKey: $"{cycle.Id}:{type}:{recipientEmployeeId}:{deadlineUtc.Ticks}");
    }

    public static IReadOnlyList<PerformanceNotification> ForExceptionCase(
        PerformanceCycle cycle,
        Guid exceptionCaseId,
        PerformanceNotificationType type,
        IEnumerable<Guid> recipientEmployeeIds,
        string subject)
    {
        var (title, message) = DescribeException(type, cycle.Name, subject);

        return recipientEmployeeIds
            .Distinct()
            .Select(employeeId => PerformanceNotification.Create(
                cycle.TenantId,
                employeeId,
                type,
                title,
                message,
                cycle.Id,
                dedupKey: $"{cycle.Id}:{exceptionCaseId}:{type}:{employeeId}"))
            .ToList();
    }

    private static (string Title, string Message) DescribeLifecycle(
        PerformanceCycle cycle,
        PerformanceNotificationType type)
        => type switch
        {
            PerformanceNotificationType.CyclePublished =>
                ("You're part of a performance cycle", $"You have been added to the performance cycle \"{cycle.Name}\"."),
            PerformanceNotificationType.CycleActivated =>
                ("Performance cycle is now open", $"The performance cycle \"{cycle.Name}\" is now active."),
            PerformanceNotificationType.CycleClosed =>
                ("Performance cycle closed", $"The performance cycle \"{cycle.Name}\" has been closed."),
            _ => (cycle.Name, cycle.Name),
        };

    private static (string Title, string Message) DescribeDeadline(
        PerformanceCycle cycle,
        PerformanceNotificationType type,
        DateTime deadlineUtc)
        => type == PerformanceNotificationType.DeadlineOverdue
            ? ("Objective-setting deadline passed",
                $"The objective-setting deadline for \"{cycle.Name}\" passed on {deadlineUtc:MMM d, yyyy}.")
            : ("Objective-setting deadline approaching",
                $"The objective-setting deadline for \"{cycle.Name}\" is on {deadlineUtc:MMM d, yyyy}.");

    private static (string Title, string Message) DescribeException(
        PerformanceNotificationType type,
        string cycleName,
        string subject)
        => type switch
        {
            PerformanceNotificationType.ExceptionOpened =>
                ("Performance exception opened", $"A governed exception was opened in \"{cycleName}\" for {subject}."),
            PerformanceNotificationType.ExceptionTransferred =>
                ("Performance exception transferred", $"A governed exception in \"{cycleName}\" was transferred for {subject}."),
            PerformanceNotificationType.ExceptionResolved =>
                ("Performance exception resolved", $"A governed exception in \"{cycleName}\" was resolved for {subject}."),
            _ => (cycleName, cycleName)
        };
}
