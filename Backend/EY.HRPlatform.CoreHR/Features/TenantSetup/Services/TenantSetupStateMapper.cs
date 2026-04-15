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

    public static TenantSetupStateDto Map(TenantSetupState? state)
    {
        var phase = state?.CurrentPhase ?? TenantSetupPhase.NotStarted;
        var completedSteps = GetCompletedSteps(phase);
        var pendingSteps = OrderedSteps.Where(step => !completedSteps.Contains(step)).ToList();

        return new TenantSetupStateDto
        {
            Version = state?.Version,
            CurrentPhase = ToClientPhase(phase),
            CurrentStep = completedSteps.Count,
            TotalSteps = OrderedSteps.Count,
            NextAction = phase == TenantSetupPhase.NotStarted ? "Start setup" : "Resume setup",
            CompletedSteps = completedSteps,
            PendingSteps = pendingSteps,
            CanStartSetup = phase == TenantSetupPhase.NotStarted,
            CanResumeSetup = phase != TenantSetupPhase.NotStarted && phase != TenantSetupPhase.Operational,
            ActivatedAt = state?.ActivatedAt,
            StructurallyGovernedAt = state?.StructurallyGovernedAt,
            StructurallyPublishedAt = state?.StructurallyPublishedAt,
            OperationalAt = state?.OperationalAt
        };
    }

    private static List<string> GetCompletedSteps(TenantSetupPhase phase)
    {
        var steps = new List<string>();

        if (phase >= TenantSetupPhase.Activated)
            steps.Add("activated");

        if (phase >= TenantSetupPhase.StructurallyGoverned)
            steps.Add("structurallyGoverned");

        if (phase >= TenantSetupPhase.StructurallyPublished)
            steps.Add("structurallyPublished");

        if (phase >= TenantSetupPhase.Operational)
            steps.Add("operational");

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
}