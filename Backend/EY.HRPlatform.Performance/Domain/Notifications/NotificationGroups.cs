namespace EY.HRPlatform.Performance.Domain.Notifications;

/// <summary>
/// The groups a person turns email on or off for (B-071 D8). Every kind belongs to exactly one group; a new kind
/// must be assigned here when it is introduced (the switch has no default, and a test walks every kind).
/// Deadline reminders are always emailed.
/// </summary>
public static class NotificationGroups
{
    public const string PlansAndGoals = "plans-and-goals";
    public const string ReviewsAndCalibration = "reviews-and-calibration";
    public const string OneOnOnes = "one-on-ones";
    public const string FeedbackAndPraise = "feedback-and-praise";
    public const string DeadlineReminders = "deadline-reminders";

    /// <summary>The groups whose email a person may turn off, in display order.</summary>
    public static readonly IReadOnlyList<string> Optional = [PlansAndGoals, ReviewsAndCalibration, OneOnOnes, FeedbackAndPraise];

    public static bool IsLocked(string group) => group == DeadlineReminders;

    public static string Of(PerformanceNotificationKind kind) => kind switch
    {
        PerformanceNotificationKind.PlanSubmitted or PerformanceNotificationKind.PlanReturned
            or PerformanceNotificationKind.PlanApproved or PerformanceNotificationKind.UpdateRequested
            or PerformanceNotificationKind.ObjectiveAtRisk or PerformanceNotificationKind.UpdateRequestAnswered
            or PerformanceNotificationKind.DevelopmentGoalAdded => PlansAndGoals,
        PerformanceNotificationKind.SelfAssessmentOpened or PerformanceNotificationKind.ManagerAssessmentOpened
            or PerformanceNotificationKind.SelfAssessmentSubmitted or PerformanceNotificationKind.ReviewFinalized
            or PerformanceNotificationKind.CalibrationReady or PerformanceNotificationKind.CalibrationFinalized
            or PerformanceNotificationKind.PeersNominated or PerformanceNotificationKind.PeerListApproved
            or PerformanceNotificationKind.PeerInputRequested or PerformanceNotificationKind.PeerDeclined
            or PerformanceNotificationKind.ReviewDueDateMoved or PerformanceNotificationKind.ReviewAcknowledged => ReviewsAndCalibration,
        PerformanceNotificationKind.OneOnOneStarted or PerformanceNotificationKind.OneOnOneRescheduled
            or PerformanceNotificationKind.OneOnOneActionAssigned => OneOnOnes,
        PerformanceNotificationKind.FeedbackReceived or PerformanceNotificationKind.FeedbackForReport
            or PerformanceNotificationKind.FeedbackRequested or PerformanceNotificationKind.FeedbackRequestResponded
            or PerformanceNotificationKind.PraiseReceived or PerformanceNotificationKind.PraiseForReport => FeedbackAndPraise,
        PerformanceNotificationKind.ReviewReminder => DeadlineReminders,
        _ => throw new ArgumentOutOfRangeException(nameof(kind), kind, "Assign the notification kind to a group."),
    };
}
