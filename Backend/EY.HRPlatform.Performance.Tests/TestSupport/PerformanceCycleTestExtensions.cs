using System.Reflection;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Tests.TestSupport;

/// <summary>
/// Test scaffolding for the lean campaign model. Downstream-module tests need a cycle in the
/// in-flight <see cref="PerformanceCycleStatus.Launched"/> state, which these helpers force
/// directly. New launch behaviour is covered by dedicated aggregate/handler tests.
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
    /// <summary>Forces the cycle into the in-flight Launched state for downstream-module tests.</summary>
    internal static PerformanceCycle ForceLaunched(this PerformanceCycle cycle)
    {
        SetStatus(cycle, PerformanceCycleStatus.Launched);
        return cycle;
    }

    internal static void Publish(this PerformanceCycle cycle, int resolvedPopulationCount, DateTime occurredAt)
        => cycle.ForceLaunched();

    private static void SetStatus(PerformanceCycle cycle, PerformanceCycleStatus status)
        => typeof(PerformanceCycle)
            .GetProperty(nameof(PerformanceCycle.Status), BindingFlags.Public | BindingFlags.Instance)!
            .SetValue(cycle, status);

    /// <summary>
    /// Forces an assignment's status, so a closure test can arrange "every manager assessment is
    /// finalized" without driving each assessment through its full authoring flow.
    /// </summary>
    internal static void ForceStatus(
        this Performance.Domain.Entities.EvaluationAssignment assignment,
        EvaluationAssignmentStatus status)
        => typeof(Performance.Domain.Entities.EvaluationAssignment)
            .GetProperty(
                nameof(Performance.Domain.Entities.EvaluationAssignment.Status),
                BindingFlags.Public | BindingFlags.Instance)!
            .SetValue(assignment, status);
}
