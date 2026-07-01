using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Objectives;

public sealed class DecideObjectiveApprovalCommandHandlerTests
{
    [Fact]
    public async Task Handle_ApprovesOnlyThroughTheManagersAssignedApprovalWorkItem()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            "Improve onboarding", null, "Completion", "100%", DateTime.UtcNow.AddDays(10), 20);
        objective.Submit(DateTime.UtcNow);
        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, managerEmployeeId,
            CampaignWorkItemType.ObjectiveApproval, DateTime.UtcNow.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        var handler = new DecideObjectiveApprovalCommandHandler(
            db, new StubCurrentUserContext { EmployeeId = managerEmployeeId });

        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Approve), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Approved, objective.Status);
        Assert.Equal(CampaignWorkItemStatus.Completed, approval.Status);
    }
}
