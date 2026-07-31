using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-04 guardrail 3: tenant fail-closed — asserts a foreign tenant reads zero rows
/// from live Performance campaign data and audit events.
/// </summary>
public class TenantIsolationTests
{
    [Fact]
    public async Task ForeignTenant_CannotReadCampaigns()
    {
        var now = DateTime.UtcNow;
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"tenant-isolation-campaigns-{Guid.NewGuid()}";

        // Seed: cycle under tenantA
        await using var seedDb = PerformanceTestContext.Create(tenantA, out _, dbName);
        var cycle = TestCycles.Create(
            tenantA, "FY26 Tenant A", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        seedDb.PerformanceCycles.Add(cycle);
        await seedDb.SaveChangesAsync();

        // Query: under tenantB — should see nothing
        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _, dbName);
        var cycles = await foreignDb.PerformanceCycles.ToListAsync();
        Assert.Empty(cycles);
    }

    [Fact]
    public async Task ForeignTenant_CannotReadAuditEvents()
    {
        var now = DateTime.UtcNow;
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"tenant-isolation-audit-{Guid.NewGuid()}";

        // Seed: cycle + audit event under tenantA
        await using var seedDb = PerformanceTestContext.Create(tenantA, out _, dbName);
        var cycle = TestCycles.Create(
            tenantA, "FY26 Tenant A Audit", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        seedDb.PerformanceCycles.Add(cycle);

        var auditEvent = PerformanceCycleAuditEvent.Create(
            tenantA, cycle.Id, PerformanceCycleAuditAction.Created,
            Guid.NewGuid(), "Test Actor", "Campaign created");
        seedDb.PerformanceCycleAuditEvents.Add(auditEvent);
        await seedDb.SaveChangesAsync();

        // Query: under tenantB — should see nothing
        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _, dbName);
        var auditEvents = await foreignDb.PerformanceCycleAuditEvents.ToListAsync();
        Assert.Empty(auditEvents);
    }

    [Fact]
    public async Task ForeignTenant_CannotReadCampaignStrategicObjectives()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"tenant-isolation-campaign-objectives-{Guid.NewGuid()}";
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

        await using (var seedDb = PerformanceTestContext.Create(tenantA, out _, dbName))
        {
            var cycle = PerformanceCycle.CreateDraft(
                tenantA,
                "FY26 Tenant A",
                "fy26-tenant-a",
                2026,
                null,
                Guid.NewGuid(),
                "HR Admin",
                start,
                start.AddDays(14),
                start.AddDays(21),
                start.AddDays(30),
                CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), start));
            var objective = cycle.AddStrategicObjective("Improve delivery", null, "Consulting");
            seedDb.PerformanceCycles.Add(cycle);
            seedDb.CampaignStrategicObjectives.Add(objective);
            await seedDb.SaveChangesAsync();
        }

        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _, dbName);
        Assert.Empty(await foreignDb.CampaignStrategicObjectives.ToListAsync());
    }

    [Fact]
    public async Task ForeignTenant_CannotUpdateCampaignDraft()
    {
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();
        var dbName = $"tenant-isolation-update-{Guid.NewGuid()}";
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        Guid cycleId;

        await using (var seedDb = PerformanceTestContext.Create(tenantA, out _, dbName))
        {
            var cycle = PerformanceCycle.CreateDraft(
                tenantA,
                "FY26 Tenant A",
                "fy26-tenant-a",
                2026,
                null,
                Guid.NewGuid(),
                "HR Admin",
                start,
                start.AddDays(14),
                start.AddDays(21),
                start.AddDays(30),
                CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), start));
            seedDb.PerformanceCycles.Add(cycle);
            await seedDb.SaveChangesAsync();
            cycleId = cycle.Id;
        }

        var foreignTenantContext = new TenantContext();
        foreignTenantContext.SetTenant(tenantB);
        await using (var foreignDb = PerformanceTestContext.Create(foreignTenantContext, dbName))
        {
            var handler = new UpdateCycleCommandHandler(
                foreignDb,
                foreignTenantContext,
                new StubCurrentUserContext(),
                Options.Create(new ReminderOptions()));

            var result = await handler.Handle(
                new UpdateCycleCommand(
                    cycleId,
                    1,
                    "Changed",
                    null,
                    2026,
                    start,
                    start.AddDays(14),
                    start.AddDays(21),
                    start.AddDays(30)),
                CancellationToken.None);

            Assert.True(result.IsFailure);
            Assert.Contains("NotFound", result.Error.Code);
        }

        await using var verifyDb = PerformanceTestContext.Create(tenantA, out _, dbName);
        var stored = await verifyDb.PerformanceCycles.SingleAsync(c => c.Id == cycleId);
        Assert.Equal("FY26 Tenant A", stored.Name);
    }

    [Fact]
    public async Task ReadingCampaignDraft_DoesNotMutateCampaignOrAuditRows()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"campaign-read-no-write-{Guid.NewGuid()}";
        var start = new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
        Guid cycleId;
        DateTime? originalUpdatedAt;

        await using (var seedDb = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var cycle = PerformanceCycle.CreateDraft(
                tenantId,
                "FY26 Read Only",
                "fy26-read-only",
                2026,
                null,
                Guid.NewGuid(),
                "HR Admin",
                start,
                start.AddDays(14),
                start.AddDays(21),
                start.AddDays(30),
                CampaignPlanningRulesSnapshot.Capture(5, "[25,50,75,100]", "Quantitative,Qualitative", Guid.NewGuid(), start));
            seedDb.PerformanceCycles.Add(cycle);
            seedDb.PerformanceCycleAuditEvents.Add(PerformanceCycleAuditEvent.Create(
                tenantId,
                cycle.Id,
                PerformanceCycleAuditAction.Created,
                Guid.NewGuid(),
                "HR Admin"));
            await seedDb.SaveChangesAsync();
            cycleId = cycle.Id;
            originalUpdatedAt = cycle.UpdatedAt;
        }

        var tenantContext = new TenantContext();
        tenantContext.SetTenant(tenantId);
        await using (var readDb = PerformanceTestContext.Create(tenantContext, dbName))
        {
            var handler = new GetCycleByIdQueryHandler(readDb, Options.Create(new ReminderOptions()));
            var result = await handler.Handle(new GetCycleByIdQuery(cycleId), CancellationToken.None);
            Assert.True(result.IsSuccess);
        }

        await using var verifyDb = PerformanceTestContext.Create(tenantId, out _, dbName);
        var stored = await verifyDb.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == cycleId);
        Assert.Equal(originalUpdatedAt, stored.UpdatedAt);
        Assert.Equal(1, await verifyDb.PerformanceCycleAuditEvents.CountAsync(a => a.CycleId == cycleId));
    }
}
