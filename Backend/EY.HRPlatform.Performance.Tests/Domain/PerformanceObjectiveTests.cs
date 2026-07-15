using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;

namespace EY.HRPlatform.Performance.Tests.Domain;

public class PerformanceObjectiveTests
{
    [Fact]
    public void Create_IndividualSmartObjective_RequiresMeasurableOutcomeAndTarget()
    {
        var dueDate = new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Deliver onboarding", "Complete the delivery", "Completion rate", "100%", dueDate, 25m);

        Assert.Equal(ObjectiveStatus.Draft, objective.Status);
        Assert.Equal("Completion rate", objective.SuccessMeasure);
        Assert.Equal(25m, objective.Weight);
    }

    [Fact]
    public void Submit_IndividualObjective_MovesItToPendingManagerApproval()
    {
        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Deliver onboarding", null, "Completion rate", "100%", DateTime.UtcNow.AddDays(30), null);

        objective.Submit(DateTime.UtcNow);

        Assert.Equal(ObjectiveStatus.PendingApproval, objective.Status);
    }

    [Fact]
    public void Return_SubmittedObjective_MakesItEditableForRevision()
    {
        var objective = PerformanceObjective.Create(
            Guid.NewGuid(), Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
            "Deliver onboarding", null, "Completion rate", "100%", DateTime.UtcNow.AddDays(30), null);
        objective.Submit(DateTime.UtcNow);

        objective.Return(DateTime.UtcNow);

        Assert.Equal(ObjectiveStatus.Returned, objective.Status);
    }
}
