using EY.HRPlatform.Performance.Domain.Calibration;
using EY.HRPlatform.Performance.Domain.Notifications;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Reviews;

namespace EY.HRPlatform.Performance.Infrastructure.Notifications;

/// <summary>
/// The in-app wording per notification kind, composed once when the notification is made. The apps
/// are English-only; the contract carries <c>kind</c> beside the text so a later locale-aware template
/// can replace it without changing clients.
/// </summary>
public static class PerformanceNotificationTemplates
{
    public static string PlanPath(Guid cycleId, Guid planId) => $"/performance/cycles/{cycleId}/plans/{planId}";
    public static string ObjectivePath(Guid cycleId, Guid objectiveId, bool record = false)
        => $"/performance/cycles/{cycleId}/objectives/{objectiveId}{(record ? "?mode=record" : "")}";
    public static string ReviewPath(Guid reviewId) => $"/performance/reviews/{reviewId}";
    public static string RoundPath(Guid roundId) => $"/performance/reviews/rounds/{roundId}";
    public static string CalibrationPath(Guid roundId) => $"/performance/reviews/rounds/{roundId}/calibration";

    public static PerformanceNotificationText ForPlan(EmployeePlan plan, PerformanceNotificationKind kind, string? actorName)
    {
        var href = PlanPath(plan.CycleId, plan.Id);
        var actor = Clean(actorName);
        return kind switch
        {
            PerformanceNotificationKind.PlanSubmitted => new($"{actor ?? plan.EmployeeDisplayName} submitted their plan",
                "Ready for your review", actor ?? plan.EmployeeDisplayName, href),
            PerformanceNotificationKind.PlanReturned => new("Your plan was returned",
                actor is null ? "Open it to see what to change" : $"{actor} asked for changes", actor, href),
            PerformanceNotificationKind.PlanApproved => new("Your plan was approved",
                actor is null ? "You can now record progress" : $"Approved by {actor}", actor, href),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), "Choose a plan notification kind."),
        };
    }

    public static PerformanceNotificationText ForUpdateRequest(UpdateRequest request, string? objectiveTitle)
    {
        var actor = Clean(request.RequestedByName);
        var title = $"{actor ?? "Your reviewer"} asked for a progress update";
        return request.ObjectiveId is Guid objectiveId
            ? new(title, Clean(objectiveTitle), actor, ObjectivePath(request.CycleId, objectiveId, record: true))
            : new(title, "On your plan", actor, PlanPath(request.CycleId, request.PlanId));
    }

    public static PerformanceNotificationText ForObjectiveAtRisk(string ownerName, string objectiveTitle, bool offTrack, string path)
        => new($"{ownerName}'s objective is {(offTrack ? "off track" : "at risk")}", objectiveTitle, ownerName, path);

    public static PerformanceNotificationText ForUpdateRequestAnswered(string ownerName, string? objectiveTitle, string path)
        => new($"{ownerName} updated their progress", Clean(objectiveTitle) ?? "On their plan", ownerName, path);

    public static PerformanceNotificationText ForDevelopmentGoalAdded(string actorName, string goalTitle, string path)
        => new($"{actorName} added a development goal", goalTitle, actorName, path);

    public static string DevelopmentPath(Guid cycleId, Guid? planId, Guid employeeId, bool forOwner)
        => forOwner ? $"/performance/plan?cycle={cycleId}#development"
            : planId is Guid id ? $"{PlanPath(cycleId, id)}#development" : $"/performance/people/{employeeId}";

    public static PerformanceNotificationText ForReview(PerformanceReview review, PerformanceNotificationKind kind, string roundName)
    {
        var href = ReviewPath(review.Id);
        return kind switch
        {
            PerformanceNotificationKind.SelfAssessmentOpened => new("Your self-assessment is open", roundName, null, href),
            PerformanceNotificationKind.ManagerAssessmentOpened => new($"{review.SubjectDisplayName}'s review is ready for your assessment",
                roundName, null, href),
            PerformanceNotificationKind.SelfAssessmentSubmitted => new($"{review.SubjectDisplayName} submitted their self-assessment",
                roundName, review.SubjectDisplayName, href),
            PerformanceNotificationKind.ReviewFinalized => new("Your review is available", roundName, null, href),
            _ => throw new ArgumentOutOfRangeException(nameof(kind), "Choose a review notification kind."),
        };
    }

    public static PerformanceNotificationText ForCalibrationReady(CalibrationSession session, string roundName)
        => new("Calibration is ready", $"Every review in {roundName} has reached calibration", null,
            CalibrationPath(session.ReviewRoundId));

    public static string OneOnOnePath(Guid seriesId) => $"/performance/one-on-ones/{seriesId}";
    public static string FeedbackPath(Guid feedbackId) => $"/performance/feedback?feedback={feedbackId}";
    public static string FeedbackRequestPath(Guid requestId) => $"/performance/feedback/requests/{requestId}";
    public static string PraisePath(Guid praiseId) => $"/performance/feedback?tab=praise&praise={praiseId}";

    public static PerformanceNotificationText ForOneOnOneStarted(string actorName, Guid seriesId)
        => new($"{actorName} started 1:1s with you", null, actorName, OneOnOnePath(seriesId));

    public static PerformanceNotificationText ForOneOnOneRescheduled(string actorName, Guid seriesId)
        => new($"{actorName} moved your next 1:1", null, actorName, OneOnOnePath(seriesId));

    /// <summary>The owner reads the action's text in the app; the email never carries it.</summary>
    public static PerformanceNotificationText ForOneOnOneActionAssigned(string actorName, string actionText, Guid seriesId)
        => new($"{actorName} gave you an action from your 1:1", actionText, actorName, OneOnOnePath(seriesId));

    /// <summary>Names what the feedback is about, never what it says.</summary>
    public static PerformanceNotificationText ForFeedbackReceived(string authorName, string? subjectLabel, Guid feedbackId)
        => new($"{authorName} gave you feedback", Clean(subjectLabel), authorName, FeedbackPath(feedbackId));

    public static PerformanceNotificationText ForFeedbackForReport(string authorName, string receiverName, Guid feedbackId)
        => new($"{authorName} gave you feedback about {receiverName}", "Manager only", authorName, FeedbackPath(feedbackId));

    public static PerformanceNotificationText ForFeedbackRequested(string requesterName, string question, Guid requestId)
        => new($"{requesterName} asked for your feedback", question, requesterName, FeedbackRequestPath(requestId));

    public static PerformanceNotificationText ForFeedbackRequestResponded(string inviteeName, bool answered, string question, Guid requestId)
        => new(answered ? $"{inviteeName} answered your feedback request" : $"{inviteeName} declined your feedback request",
            question, inviteeName, FeedbackRequestPath(requestId));

    public static PerformanceNotificationText ForPraiseReceived(string authorName, string valueName, Guid praiseId)
        => new($"{authorName} praised you for {valueName}", null, authorName, PraisePath(praiseId));

    public static PerformanceNotificationText ForPraiseForReport(string authorName, string recipientName, string valueName, Guid praiseId)
        => new($"{authorName} praised {recipientName} for {valueName}", null, authorName, PraisePath(praiseId));

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
