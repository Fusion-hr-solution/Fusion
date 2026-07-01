using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public sealed class PerformanceObjectiveProgressModeTests
{
    [Fact]
    public void SetProgressMode_DefaultsToManualPercent()
    {
        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Test", null, "Measure", "100%", DateTime.UtcNow.AddDays(7), 20);

        Assert.Equal(ObjectiveProgressMode.ManualPercent, objective.ProgressMode);
        Assert.Null(objective.ManualProgressPercent);
    }

    [Fact]
    public void SetProgressMode_ChangesMode()
    {
        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Test", null, "Measure", "100%", DateTime.UtcNow.AddDays(7), 20);

        objective.SetProgressMode(ObjectiveProgressMode.MilestoneRollup);
        Assert.Equal(ObjectiveProgressMode.MilestoneRollup, objective.ProgressMode);
    }

    [Fact]
    public void SetManualProgress_Succeeds_WhenModeIsManualPercent()
    {
        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Test", null, "Measure", "100%", DateTime.UtcNow.AddDays(7), 20);

        objective.SetManualProgress(45.5m, DateTime.UtcNow);
        Assert.Equal(45.5m, objective.ManualProgressPercent);
    }

    [Fact]
    public void SetManualProgress_Throws_WhenModeIsMilestoneRollup()
    {
        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Test", null, "Measure", "100%", DateTime.UtcNow.AddDays(7), 20);

        objective.SetProgressMode(ObjectiveProgressMode.MilestoneRollup);

        var ex = Assert.Throws<DomainRuleViolationException>(() => objective.SetManualProgress(45.5m, DateTime.UtcNow));
        Assert.Contains("ModeMismatch", ex.Message);
    }
}
