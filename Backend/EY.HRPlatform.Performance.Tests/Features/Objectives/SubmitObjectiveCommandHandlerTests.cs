using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Objectives;

public sealed class SubmitObjectiveCommandHandlerTests
{
    [Fact]
    public async Task Handle_SubmitsOnlyTheCurrentEmployeesDraftObjective()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            "Improve onboarding", null, "Completion", "100%", DateTime.UtcNow.AddDays(10), 20);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new SubmitObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });

        var result = await handler.Handle(new SubmitObjectiveCommand(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.PendingApproval, objective.Status);
    }
}
