using System.Reflection;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>
/// Test scaffolding for the lean campaign model. The Packet A launch path (governance,
/// assignment preparation, publish/activate) was removed in P1.2; downstream module tests
/// (milestones, objectives, collective, feedback, reviews, cascade) still need a cycle in an
/// in-flight (<see cref="PerformanceCycleStatus.Active"/>) state, which these helpers force
/// directly. New P1.2 launch behaviour is covered by dedicated aggregate/handler tests.
/// </summary>
internal static class TestCycles
{
    internal static PerformanceCycle Create(
        Guid tenantId,
        string name,
        PerformanceCycleType type,
        DateTime periodStart,
        DateTime periodEnd,
        DateTime? objectiveSettingDeadline = null,
        bool populationIncludeInactive = false,
        string? description = null)
    {
        var opening = DateTime.SpecifyKind(periodStart, DateTimeKind.Utc);
        var lockDate = DateTime.SpecifyKind(periodEnd, DateTimeKind.Utc);
        var submission = objectiveSettingDeadline is { } deadline
            ? DateTime.SpecifyKind(deadline, DateTimeKind.Utc)
            : opening.AddDays(1);
        var approval = submission.AddDays(1) <= lockDate ? submission.AddDays(1) : lockDate;

        var snapshot = CampaignPlanningRulesSnapshot.Capture(
            5, "0.10,0.20,0.30", "Quantitative,Qualitative", Guid.NewGuid(), opening);

        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            name,
            $"{name.ToLowerInvariant().Replace(' ', '-')}-{Guid.NewGuid():N}",
            opening.Year,
            description,
            Guid.NewGuid(),
            "Test Owner",
            opening,
            submission,
            approval,
            lockDate,
            snapshot);

        if (populationIncludeInactive)
        {
            cycle.SetPopulation(true, cycle.PopulationRules);
        }

        SetType(cycle, type);
        return cycle;
    }

    private static void SetType(PerformanceCycle cycle, PerformanceCycleType type)
        => typeof(PerformanceCycle).GetProperty(nameof(PerformanceCycle.Type))!.SetValue(cycle, type);
}

internal static class PerformanceCycleTestExtensions
{
    /// <summary>No-op shim: governance configuration was removed from the lean model.</summary>
    internal static PerformanceCycle ConfigureForAssignmentPreparation(this PerformanceCycle cycle) => cycle;

    /// <summary>No-op shim: campaign governance was removed from the lean model.</summary>
    internal static PerformanceCycle ConfigureGovernance(
        this PerformanceCycle cycle,
        Guid retentionPolicyVersionId,
        bool requireTeamObjectiveSuperiorApproval,
        int minimumAnonymousFeedbackResponses,
        CampaignFeedbackVisibility feedbackVisibility,
        IEnumerable<Guid> exceptionOwnerEmployeeIds) => cycle;

    /// <summary>Forces the cycle into the in-flight Active state for downstream-module tests.</summary>
    internal static PerformanceCycle ForceActive(this PerformanceCycle cycle)
    {
        SetStatus(cycle, PerformanceCycleStatus.Active);
        return cycle;
    }

    internal static void Publish(this PerformanceCycle cycle, int resolvedPopulationCount, DateTime occurredAt)
        => cycle.ForceActive();

    internal static void BeginAssignmentPreparation(this PerformanceCycle cycle, int candidateCount, DateTime occurredAt)
        => cycle.ForceActive();

    internal static void MarkReadyToLaunch(
        this PerformanceCycle cycle,
        int finalResponsibilityCount,
        int readinessFailureCount,
        bool hasAcceptedWorkforceDelta,
        DateTime occurredAt)
        => cycle.ForceActive();

    internal static void Activate(this PerformanceCycle cycle, DateTime occurredAt)
        => cycle.ForceActive();

    private static void SetStatus(PerformanceCycle cycle, PerformanceCycleStatus status)
        => typeof(PerformanceCycle)
            .GetProperty(nameof(PerformanceCycle.Status), BindingFlags.Public | BindingFlags.Instance)!
            .SetValue(cycle, status);
}
