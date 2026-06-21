using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class CurateCampaignResponsibilityCommandHandlerTests
{
    [Fact]
    public async Task Handle_ReturnsTheCuratedRevisionForImmediateReadback()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(10));
        cycle.BeginAssignmentPreparation(1, now);
        var subjectId = Guid.NewGuid();
        var assigneeId = Guid.NewGuid();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
        await db.SaveChangesAsync();
        var handler = new CurateCampaignResponsibilityCommandHandler(db, tenantContext, new StubCurrentUserContext(), new FakeCoreWorkforceClient
        {
            ResolvePool = [FakeCoreWorkforceClient.Employee(subjectId, "Employee"), FakeCoreWorkforceClient.Employee(assigneeId, "Manager")]
        });

        var result = await handler.Handle(new CurateCampaignResponsibilityCommand(cycle.Id, cycle.Version, subjectId, assigneeId,
            CampaignResponsibilityDuty.ObjectiveApproval, "PrimaryManager", null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(assigneeId, result.Value.Responsibility.AssigneeEmployeeId);
        Assert.Equal(1, result.Value.Responsibility.Revision);
    }

    [Fact]
    public async Task Handle_WhenSubjectIsNoLongerActive_RejectsResponsibility()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(10));
        cycle.BeginAssignmentPreparation(1, now);
        var subjectId = Guid.NewGuid();
        var assigneeId = Guid.NewGuid();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Inactive employee"));
        await db.SaveChangesAsync();
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool = [
                FakeCoreWorkforceClient.Employee(subjectId, "Inactive employee") with { IsActive = false },
                FakeCoreWorkforceClient.Employee(assigneeId, "Active manager")
            ]
        };
        var handler = new CurateCampaignResponsibilityCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce);

        var result = await handler.Handle(new CurateCampaignResponsibilityCommand(
            cycle.Id, cycle.Version, subjectId, assigneeId, CampaignResponsibilityDuty.ObjectiveApproval,
            "PrimaryManager", null), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.IneligibleSubject", result.Error.Code);
    }
}
