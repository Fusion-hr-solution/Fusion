using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-04 guardrail 1: freeze immutability — asserts ConfigureCycleGovernance on an
/// AssignmentPreparation-status cycle returns Error.Conflict Cycle.GovernanceLocked.
/// </summary>
public class FreezeImmutabilityTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task ConfigureGovernance_OnPublishedCycle_ReturnsGovernanceLocked()
    {
        var now = DateTime.UtcNow;
        var tenantContext = new TenantContext();
        tenantContext.SetTenant(TenantId);

        // Seed: cycle in AssignmentPreparation (post-publish) state
        var dbName = $"perf-freeze-{Guid.NewGuid()}";
        await using (var seed = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var cycle = PerformanceCycle.Create(
                TenantId, "FY26 Freeze Test", PerformanceCycleType.Annual,
                now.AddDays(-1), now.AddDays(10));
            cycle.ConfigureForAssignmentPreparation();
            cycle.BeginAssignmentPreparation(1, now);
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
        }

        // Act: attempt to reconfigure governance on a published cycle
        await using var db = PerformanceTestContext.Create(tenantContext, dbName);
        var storedCycle = await db.PerformanceCycles.SingleAsync();
        var cycleId = storedCycle.Id;
        var version = storedCycle.Version;

        var handler = new ConfigureCycleGovernanceCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));
        var result = await handler.Handle(
            new ConfigureCycleGovernanceCommand(
                cycleId, version,
                Guid.NewGuid(), false, 3,
                CampaignFeedbackVisibility.AnonymousToSubject,
                [Guid.NewGuid()]),
            CancellationToken.None);

        // Assert: governance is locked post-publish
        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.GovernanceLocked", result.Error.Code);

        // Verify cycle status unchanged
        await using var verify = PerformanceTestContext.Create(tenantContext, dbName);
        var stored = await verify.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == cycleId);
        Assert.Equal(PerformanceCycleStatus.AssignmentPreparation, stored.Status);
    }
}
