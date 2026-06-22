using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class GetCycleReadinessQueryTests
{
    [Fact]
    public async Task Handle_UsesFinalResponsibilitiesRatherThanLegacyParticipantFields()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        var subjectId = Guid.NewGuid();
        var assigneeId = Guid.NewGuid();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
        db.CampaignAssignmentResponsibilities.Add(CampaignAssignmentResponsibility.Confirm(
            tenantId, cycle.Id, subjectId, assigneeId, "Manager", CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated, "PrimaryManager"));
        await db.SaveChangesAsync();

        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Employee"),
                FakeCoreWorkforceClient.Employee(assigneeId, "Manager"),
            ],
        };
        var handler = new GetCycleReadinessQueryHandler(db, workforce);
        var result = await handler.Handle(new GetCycleReadinessQuery(cycle.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(1, result.Value.ConfirmedObjectiveResponsibilityCount);
        Assert.Equal(0, result.Value.MissingObjectiveResponsibilityCount);
        Assert.False(result.Value.WorkforceDelta.BlocksLaunch);
    }
}
