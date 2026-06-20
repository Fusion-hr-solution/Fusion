using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class MarkCycleReadyToLaunchCommandHandlerTests
{
    [Fact]
    public async Task Handle_WhenEveryParticipantHasFinalObjectiveResponsibility_MarksCampaignReady()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(10));
        cycle.BeginAssignmentPreparation(1, now);
        var subjectId = Guid.NewGuid();
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(tenantId, cycle.Id, subjectId, "Employee"));
        db.CampaignAssignmentResponsibilities.Add(CampaignAssignmentResponsibility.Confirm(
            tenantId, cycle.Id, subjectId, Guid.NewGuid(), CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated, "PrimaryManager"));
        await db.SaveChangesAsync();

        var handler = new MarkCycleReadyToLaunchCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));
        var result = await handler.Handle(new MarkCycleReadyToLaunchCommand(cycle.Id, cycle.Version, true), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.ReadyToLaunch.ToString(), result.Value.Status);
    }
}
