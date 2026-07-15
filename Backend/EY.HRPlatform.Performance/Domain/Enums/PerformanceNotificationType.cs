namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Category of an in-app performance notification.
/// </summary>
public enum PerformanceNotificationType
{
    CyclePublished,
    CycleActivated,
    CycleClosed,
    DeadlineDueSoon,
    DeadlineOverdue,
    PlanningReminder,
    ExceptionOpened,
    ExceptionTransferred,
    ExceptionResolved
}
