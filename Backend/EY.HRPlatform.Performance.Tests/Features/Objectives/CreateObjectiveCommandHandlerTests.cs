using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Objectives;

public sealed class CreateObjectiveCommandHandlerTests
{
    [Fact]
    public async Task Handle_CreatesDraftObjectiveForEmployeeWithActivePlanningTask()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);
        db.CampaignWorkItems.Add(CampaignWorkItem.Create(tenantId, cycle.Id, employeeId, employeeId,
            CampaignWorkItemType.ObjectivePlanning, now.AddDays(10)));
        await db.SaveChangesAsync();

        var handler = new CreateObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });
        var result = await handler.Handle(new CreateObjectiveCommand(
            cycle.Id, "Improve onboarding", null, "Completion", "100%", now.AddDays(7), 20, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var objective = Assert.Single(db.PerformanceObjectives);
        Assert.Equal(employeeId, objective.OwnerEmployeeId);
        Assert.Equal(ObjectiveStatus.Draft, objective.Status);
    }
}
