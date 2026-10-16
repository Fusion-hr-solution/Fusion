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

    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
