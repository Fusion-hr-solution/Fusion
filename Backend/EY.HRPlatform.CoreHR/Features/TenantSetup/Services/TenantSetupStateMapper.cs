using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Services;

public static class TenantSetupStateMapper
{
    private static readonly List<string> OrderedSteps =
    [
        "activated",
        "structurallyGoverned",
        "structurallyPublished",
        "operational"
    ];

    public static TenantSetupStateDto Map(
        TenantSetupState? state,
        IReadOnlyCollection<TenantSetupActivity>? recentActivities = null)
    {
        var phase = state?.CurrentPhase ?? TenantSetupPhase.NotStarted;
        var completedSteps = GetCompletedSteps(phase);
        var pendingSteps = OrderedSteps.Where(step => !completedSteps.Contains(step)).ToList();
        var activities = recentActivities?
            .Select(MapActivity)
            .ToList() ?? [];

        return new TenantSetupStateDto
        {
            Version = state?.Version,
            CurrentPhase = ToClientPhase(phase),
            CurrentStep = completedSteps.Count,
            TotalSteps = OrderedSteps.Count,
            NextAction = GetNextAction(phase),
            CompletedSteps = completedSteps,
            PendingSteps = pendingSteps,
            CanStartSetup = phase == TenantSetupPhase.NotStarted,
            CanResumeSetup =
                phase != TenantSetupPhase.NotStarted &&
                phase < TenantSetupPhase.StructurallyPublished,
            ActivatedAt = state?.ActivatedAt,
            StructurallyGovernedAt = state?.StructurallyGovernedAt,
            ApprovedAt = state?.ApprovedAt,
            ApprovedByUserId = state?.ApprovedByUserId,
            ApprovedByFullName = state?.ApprovedByFullName,
            ApprovedByRole = state?.ApprovedByRole,
            IsApprovedInPlatformAssistMode = state?.IsApprovedInPlatformAssistMode ?? false,
            StructurallyPublishedAt = state?.StructurallyPublishedAt,
            OperationalAt = state?.OperationalAt,
            RecentActivities = activities,
        };
    }

    private static string GetNextAction(TenantSetupPhase phase) => phase switch
    {
        TenantSetupPhase.NotStarted => "Start setup",
        TenantSetupPhase.Activated => "Review the structure and approve when ready",
        TenantSetupPhase.StructurallyGoverned => "Publish the approved structure to complete setup",
        TenantSetupPhase.StructurallyPublished => "Setup is complete",
        TenantSetupPhase.Operational => "Setup is complete",
        _ => throw new ArgumentOutOfRangeException(nameof(phase), phase, null)
    };

    private static TenantSetupActivityDto MapActivity(TenantSetupActivity activity)
        => new()
        {
            Id = activity.Id,
            ActivityType = ToClientActivityType(activity.ActivityType),
            OccurredAt = activity.CreatedAt,
            ActorUserId = activity.ActorUserId,
            ActorFullName = activity.ActorFullName,
            ActorRole = activity.ActorRole,
            IsPlatformAssisted = activity.IsPlatformAssisted,
        };

    private static List<string> GetCompletedSteps(TenantSetupPhase phase)
    {
        var steps = new List<string>();

        if (phase >= TenantSetupPhase.Activated)
            steps.Add("activated");

        if (phase >= TenantSetupPhase.StructurallyGoverned)
            steps.Add("structurallyGoverned");

        if (phase >= TenantSetupPhase.StructurallyPublished)
        {
            steps.Add("structurallyPublished");
            steps.Add("operational");
        }

        return steps;
    }

    private static string ToClientPhase(TenantSetupPhase phase) => phase switch
    {
        TenantSetupPhase.NotStarted => "notStarted",
        TenantSetupPhase.Activated => "activated",
        TenantSetupPhase.StructurallyGoverned => "structurallyGoverned",
        TenantSetupPhase.StructurallyPublished => "structurallyPublished",
        TenantSetupPhase.Operational => "operational",
        _ => throw new ArgumentOutOfRangeException(nameof(phase), phase, null)
    };

    private static string ToClientActivityType(TenantSetupActivityType activityType) => activityType switch
    {
        TenantSetupActivityType.Approved => "approved",
        TenantSetupActivityType.Reopened => "reopened",
        TenantSetupActivityType.Published => "published",
        TenantSetupActivityType.Completed => "completed",
        _ => throw new ArgumentOutOfRangeException(nameof(activityType), activityType, null)
    };
}