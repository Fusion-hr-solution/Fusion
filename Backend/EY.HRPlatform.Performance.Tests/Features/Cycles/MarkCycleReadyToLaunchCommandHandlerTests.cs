using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class MarkCycleReadyToLaunchCommandHandlerTests
{
    private static (PerformanceCycle Cycle, Guid SubjectId, Guid AssigneeId) SeedCovered(
        PerformanceDbContext db, Guid tenantId, DateTime now)
    {
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
        return (cycle, subjectId, assigneeId);
    }

    [Fact]
    public async Task Handle_WhenEveryParticipantCoveredAndDeltaAccepted_MarksCampaignReady()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var (cycle, subjectId, assigneeId) = SeedCovered(db, tenantId, now);
        await db.SaveChangesAsync();
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Employee"),
                FakeCoreWorkforceClient.Employee(assigneeId, "Manager"),
            ],
        };

        var handler = new MarkCycleReadyToLaunchCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce, Options.Create(new ReminderOptions()));
        var result = await handler.Handle(
            new MarkCycleReadyToLaunchCommand(cycle.Id, cycle.Version, AcceptCurrentWorkforceDelta: true),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(PerformanceCycleStatus.ReadyToLaunch.ToString(), result.Value.Status);
    }

    [Fact]
    public async Task Handle_WhenWorkforceDeltaNotAccepted_DoesNotMarkReady()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var (cycle, subjectId, assigneeId) = SeedCovered(db, tenantId, now);
        await db.SaveChangesAsync();
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Employee"),
                FakeCoreWorkforceClient.Employee(assigneeId, "Manager"),
            ],
        };

        var handler = new MarkCycleReadyToLaunchCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce, Options.Create(new ReminderOptions()));
        var result = await handler.Handle(
            new MarkCycleReadyToLaunchCommand(cycle.Id, cycle.Version, AcceptCurrentWorkforceDelta: false),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.NotReady", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WhenFinalApproverNoLongerActive_BlocksLaunch()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out var tenantContext);
        var (cycle, subjectId, assigneeId) = SeedCovered(db, tenantId, now);
        await db.SaveChangesAsync();
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(subjectId, "Employee"),
                FakeCoreWorkforceClient.Employee(assigneeId, "Manager") with { IsActive = false },
            ],
        };

        var handler = new MarkCycleReadyToLaunchCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), workforce, Options.Create(new ReminderOptions()));
        var result = await handler.Handle(
            new MarkCycleReadyToLaunchCommand(cycle.Id, cycle.Version, AcceptCurrentWorkforceDelta: true),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.WorkforceDeltaBlocksLaunch", result.Error.Code);
    }
}
