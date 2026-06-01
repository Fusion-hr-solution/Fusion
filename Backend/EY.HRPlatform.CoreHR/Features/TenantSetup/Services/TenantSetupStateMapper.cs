using EY.HRPlatform.CoreHR.Domain.Entities;
using EY.HRPlatform.CoreHR.Features.TenantSetup.Dtos;

namespace EY.HRPlatform.CoreHR.Features.TenantSetup.Services;

public static class TenantSetupStateMapper
{
    private static readonly List<string> OrderedSteps =
    [
        "setupStarted",
        "draftReady",
        "publishedLive"
    ];

    public static TenantSetupStateDto Map(
        TenantSetupState? state,
        IReadOnlyCollection<TenantSetupActivity>? recentActivities = null,
        bool hasDraftStructure = false)
    {
        var phase = state?.CurrentPhase ?? TenantSetupPhase.NotStarted;
        var hasPublishedStructure = HasPublishedStructure(state, phase);
        var isDraftCycleActive = IsDraftCycleActive(phase);
        var requiresRepublish = isDraftCycleActive && hasPublishedStructure;
        var completedSteps = GetCompletedSteps(
            phase,
            hasDraftStructure,
            hasPublishedStructure,
            requiresRepublish);
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
            NextAction = GetNextAction(phase, hasDraftStructure, requiresRepublish),
            CompletedSteps = completedSteps,
            PendingSteps = pendingSteps,
            CanStartSetup = phase == TenantSetupPhase.NotStarted,
            CanResumeSetup = isDraftCycleActive,
            HasDraftStructure = hasDraftStructure,
            HasPublishedStructure = hasPublishedStructure,
            IsDraftCycleActive = isDraftCycleActive,
            RequiresRepublish = requiresRepublish,
            PublishedStructureVersion = state?.PublishedStructureVersion ?? 0,
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

    private static string GetNextAction(
        TenantSetupPhase phase,
        bool hasDraftStructure,
        bool requiresRepublish) => phase switch
    {
        TenantSetupPhase.NotStarted => "Start setup",
        TenantSetupPhase.Activated when !hasDraftStructure => "Import or build the draft structure",
        TenantSetupPhase.Activated when requiresRepublish => "Update the draft and publish the latest structure to live",
        TenantSetupPhase.Activated => "Publish the draft structure to live when ready",
        TenantSetupPhase.StructurallyGoverned => "Publish the draft structure to live",
        TenantSetupPhase.StructurallyPublished => "The structure is live",
        TenantSetupPhase.Operational => "The structure is live",
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

    private static List<string> GetCompletedSteps(
        TenantSetupPhase phase,
        bool hasDraftStructure,
        bool hasPublishedStructure,
        bool requiresRepublish)
    {
        var steps = new List<string>();

        if (phase >= TenantSetupPhase.Activated)
            steps.Add("setupStarted");

        if (hasDraftStructure || hasPublishedStructure)
            steps.Add("draftReady");

        if (hasPublishedStructure && !requiresRepublish)
            steps.Add("publishedLive");

        return steps;
    }

    private static bool HasPublishedStructure(TenantSetupState? state, TenantSetupPhase phase)
        => state?.StructurallyPublishedAt is not null
            || state?.OperationalAt is not null
            || phase == TenantSetupPhase.StructurallyPublished
            || phase == TenantSetupPhase.Operational;

    private static bool IsDraftCycleActive(TenantSetupPhase phase)
        => phase == TenantSetupPhase.Activated || phase == TenantSetupPhase.StructurallyGoverned;

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
        TenantSetupActivityType.DraftCreated => "draftCreated",
        TenantSetupActivityType.DraftUpdated => "draftUpdated",
        TenantSetupActivityType.DraftDeleted => "draftDeleted",
        TenantSetupActivityType.DraftCleared => "draftCleared",
        TenantSetupActivityType.DraftImportUploaded => "draftImportUploaded",
        TenantSetupActivityType.DraftImportApplied => "draftImportApplied",
        _ => throw new ArgumentOutOfRangeException(nameof(activityType), activityType, null)
    };
}
