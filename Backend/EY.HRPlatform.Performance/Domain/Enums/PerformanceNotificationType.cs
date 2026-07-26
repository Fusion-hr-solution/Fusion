namespace EY.HRPlatform.Performance.Domain.Enums;

/// <summary>
/// Category of an in-app performance notification.
/// </summary>
public enum PerformanceNotificationType
{
    CyclePublished,
    CycleActivated,
    DeadlineDueSoon,
    DeadlineOverdue,
    PlanningReminder,
    PlanSubmitted,
    PlanApproved,
    PlanChangesRequested,
    ObjectiveCompleted,
    ObjectiveReopened,
    ObjectiveProgressStale,
    CheckInPlanned,
    CheckInRescheduled,
    CheckInCancelled,
    CheckInCompleted,
    CheckInReminder,
    CheckInOverdue,
    FollowUpActionAssigned,
    FollowUpActionDueSoon,
    DiscussionSignalRaised,
    EvaluationLaunched,
    EvaluationDeadlineExtended,
    EvaluationDeadlineDueSoon,
    EvaluationDeadlineOverdue,
    EvaluationSelfAssessmentSubmitted,
    EvaluationSelfAssessmentReopened,
    EvaluationFinalized,
    EvaluationAcknowledged
}
