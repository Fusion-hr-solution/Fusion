using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class PlanningApproverHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task Activate_WhenCampaignIsNotReadyToLaunch_ReturnsConflict()
    {
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "FY26 Planning",
            PerformanceCycleType.Annual,
            now.AddDays(-1),
            now.AddDays(10));
        cycle.Publish(1, now);
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(PerformanceCycleParticipant.Create(
            TenantId,
            cycle.Id,
            Guid.NewGuid(),
            "Unassigned Employee"));
        await db.SaveChangesAsync();

        var handler = new ActivateCycleCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext(),
            Options.Create(new ReminderOptions()));

        var result = await handler.Handle(new ActivateCycleCommand(cycle.Id, cycle.Version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.NotReadyToLaunch", result.Error.Code);
        Assert.Equal(PerformanceCycleStatus.AssignmentPreparation, (await db.PerformanceCycles.SingleAsync()).Status);
    }

    [Fact]
    public async Task AssignPlanningApprover_RecordsVerifiedManualOverride()
    {
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "FY26 Planning override",
            PerformanceCycleType.Annual,
            now.AddDays(-1),
            now.AddDays(10));
        cycle.Publish(1, now);
        var participant = PerformanceCycleParticipant.Create(TenantId, cycle.Id, Guid.NewGuid(), "Unassigned Employee");
        db.PerformanceCycles.Add(cycle);
        db.PerformanceCycleParticipants.Add(participant);
        await db.SaveChangesAsync();

        var approverId = Guid.NewGuid();
        var workforce = new FakeCoreWorkforceClient
        {
            ResolvePool = [FakeCoreWorkforceClient.Employee(approverId, "Verified Approver")]
        };
        var handler = new AssignPlanningApproverCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext(),
            workforce);

        var result = await handler.Handle(new AssignPlanningApproverCommand(
            cycle.Id,
            participant.Id,
            cycle.Version,
            approverId,
            "The direct manager role is vacant."), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(approverId, result.Value.PlanningApproverEmployeeId);
        Assert.Equal("ManualAssignment", result.Value.PlanningApproverSource);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(
            entry => entry.Action == PerformanceCycleAuditAction.PlanningApproverAssigned));
    }
}
