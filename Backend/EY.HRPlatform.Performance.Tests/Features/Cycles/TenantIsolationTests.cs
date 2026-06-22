using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

/// <summary>
/// D-04 guardrail 3: tenant fail-closed — asserts a foreign tenant reads zero rows
/// from PerformanceCycles, CampaignAssignmentResponsibilities, and PerformanceCycleAuditEvents.
/// </summary>
public class TenantIsolationTests
{
    [Fact]
    public async Task ForeignTenant_CannotReadCampaigns()
    {
        var now = DateTime.UtcNow;
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        // Seed: cycle under tenantA
        await using var seedDb = PerformanceTestContext.Create(tenantA, out _);
        var cycle = PerformanceCycle.Create(
            tenantA, "FY26 Tenant A", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        seedDb.PerformanceCycles.Add(cycle);
        await seedDb.SaveChangesAsync();

        // Query: under tenantB — should see nothing
        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _);
        var cycles = await foreignDb.PerformanceCycles.ToListAsync();
        Assert.Empty(cycles);
    }

    [Fact]
    public async Task ForeignTenant_CannotReadAssignments()
    {
        var now = DateTime.UtcNow;
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        // Seed: cycle + responsibility under tenantA
        await using var seedDb = PerformanceTestContext.Create(tenantA, out _);
        var cycle = PerformanceCycle.Create(
            tenantA, "FY26 Tenant A Assignments", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        seedDb.PerformanceCycles.Add(cycle);

        var responsibility = CampaignAssignmentResponsibility.Confirm(
            tenantA, cycle.Id, Guid.NewGuid(), Guid.NewGuid(),
            "Manager Name", CampaignResponsibilityDuty.ObjectiveApproval,
            CampaignAssignmentSource.Curated, "PrimaryManager");
        seedDb.CampaignAssignmentResponsibilities.Add(responsibility);
        await seedDb.SaveChangesAsync();

        // Query: under tenantB — should see nothing
        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _);
        var responsibilities = await foreignDb.CampaignAssignmentResponsibilities.ToListAsync();
        Assert.Empty(responsibilities);
    }

    [Fact]
    public async Task ForeignTenant_CannotReadAuditEvents()
    {
        var now = DateTime.UtcNow;
        var tenantA = Guid.NewGuid();
        var tenantB = Guid.NewGuid();

        // Seed: cycle + audit event under tenantA
        await using var seedDb = PerformanceTestContext.Create(tenantA, out _);
        var cycle = PerformanceCycle.Create(
            tenantA, "FY26 Tenant A Audit", PerformanceCycleType.Annual,
            now.AddDays(-1), now.AddDays(10));
        seedDb.PerformanceCycles.Add(cycle);

        var auditEvent = PerformanceCycleAuditEvent.Create(
            tenantA, cycle.Id, PerformanceCycleAuditAction.Created,
            Guid.NewGuid(), "Test Actor", "Campaign created");
        seedDb.PerformanceCycleAuditEvents.Add(auditEvent);
        await seedDb.SaveChangesAsync();

        // Query: under tenantB — should see nothing
        await using var foreignDb = PerformanceTestContext.Create(tenantB, out _);
        var auditEvents = await foreignDb.PerformanceCycleAuditEvents.ToListAsync();
        Assert.Empty(auditEvents);
    }
}
