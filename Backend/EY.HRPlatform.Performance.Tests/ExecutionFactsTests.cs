using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Progress;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>Overdue is per objective and recency is a dated fact (design §18); neither is a health rating.</summary>
public sealed class ExecutionFactsTests
{
    private static readonly Guid Tenant = Guid.NewGuid();
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);
    private static readonly DateOnly Today = new(2026, 6, 15);

    private static Objective Employee(ObjectiveMeasurement measurement, DateOnly? end = null)
        => Objective.CreateEmployee(Tenant, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "Objective", null, null,
            Start, end ?? End, measurement, 100m, null, null, Start, End);

    private static Objective WithMilestones(params DateOnly?[] dueDates)
        => Employee(ObjectiveMeasurement.WeightedMilestones(
            dueDates.Select((due, i) => ObjectiveMilestone.Create(Tenant, $"Step {i + 1}", 100m / dueDates.Length, due))));

    [Fact]
    public void An_incomplete_milestone_past_its_due_date_makes_the_objective_overdue()
    {
        var objective = WithMilestones(Today.AddDays(-1), Today.AddDays(30));

        Assert.True(ExecutionFacts.IsOverdue(objective, Today));
    }

    [Fact]
    public void Several_overdue_milestones_count_as_one_overdue_objective()
    {
        var twoLate = WithMilestones(Today.AddDays(-20), Today.AddDays(-5));
        var onTime = WithMilestones(Today.AddDays(10));

        Assert.Equal(1, ExecutionFacts.OverdueObjectiveCount([twoLate, onTime], Today));
    }

    [Fact]
    public void A_completed_late_milestone_is_not_overdue()
    {
        var objective = WithMilestones(Today.AddDays(-3), Today.AddDays(30));
        objective.ApplyMilestone(objective.Measurement!.Milestones.First().Id, completed: true);

        Assert.False(ExecutionFacts.IsOverdue(objective, Today));
    }

    [Fact]
    public void An_elapsed_end_date_makes_an_incomplete_objective_overdue_but_not_a_complete_one()
    {
        var incomplete = Employee(ObjectiveMeasurement.ManualPercentage(), end: Today.AddDays(-1));
        incomplete.ApplyManualPercentage(60m);
        var complete = Employee(ObjectiveMeasurement.ManualPercentage(), end: Today.AddDays(-1));
        complete.ApplyManualPercentage(100m);

        Assert.True(ExecutionFacts.IsOverdue(incomplete, Today));
        Assert.False(ExecutionFacts.IsOverdue(complete, Today));
    }

    [Fact]
    public void Forty_days_without_an_update_lacks_a_recent_update()
    {
        var objective = Employee(ObjectiveMeasurement.ManualPercentage());
        objective.ApplyManualPercentage(20m);
        var lastUpdate = objective.LastProgressAt!.Value;

        Assert.True(ExecutionFacts.LacksRecentUpdate(objective, lastUpdate.AddDays(-60), lastUpdate.AddDays(40)));
        Assert.False(ExecutionFacts.LacksRecentUpdate(objective, lastUpdate.AddDays(-60), lastUpdate.AddDays(29)));
    }

    [Fact]
    public void Before_the_first_update_the_recency_clock_starts_at_execution()
    {
        var objective = Employee(ObjectiveMeasurement.ManualPercentage());
        var approvedAt = new DateTime(2026, 6, 1, 9, 0, 0, DateTimeKind.Utc);

        Assert.False(ExecutionFacts.LacksRecentUpdate(objective, approvedAt, approvedAt.AddDays(10)));
        Assert.True(ExecutionFacts.LacksRecentUpdate(objective, approvedAt, approvedAt.AddDays(31)));
    }
}
