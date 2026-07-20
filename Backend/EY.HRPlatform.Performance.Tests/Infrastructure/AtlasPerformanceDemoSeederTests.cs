using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Infrastructure;

public sealed class AtlasPerformanceDemoSeederTests
{
    [Fact]
    public async Task SeedAsync_CreatesCompleteMixedStateScenario_AndIsIdempotent()
    {
        var tenantId = Guid.NewGuid();
        var tenant = new TenantContext();
        tenant.SetTenant(tenantId);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase($"atlas-progress-seed-{Guid.NewGuid():N}")
            .Options;
        await using var db = new PerformanceDbContext(options, tenant);
        var asOf = new DateTime(2026, 7, 20, 12, 0, 0, DateTimeKind.Utc);

        await AtlasPerformanceDemoSeeder.SeedAsync(db, tenantId, asOf);
        await AtlasPerformanceDemoSeeder.SeedAsync(db, tenantId, asOf);

        var cycle = await db.PerformanceCycles
            .Include(item => item.Participants)
            .SingleAsync(item => item.Slug == AtlasPerformanceDemoSeeder.CycleSlug);
        var plan = await db.EmployeeObjectivePlans
            .Include(item => item.Objectives)
            .Include(item => item.ReviewEvents)
            .SingleAsync(item => item.CycleId == cycle.Id);
        var updates = await db.ObjectiveProgressUpdates
            .Where(item => item.PlanId == plan.Id)
            .OrderBy(item => item.RecordedAt)
            .ToListAsync();

        Assert.True(cycle.IsPlanningLocked);
        Assert.Single(cycle.Participants);
        Assert.Equal(PlanStatus.Approved, plan.Status);
        Assert.Equal(4, plan.Objectives.Count);
        Assert.Contains(plan.ReviewEvents, item => item.Type == ReviewEventType.Approved);
        Assert.Equal(4, updates.Count);
        Assert.Contains(updates, item => item.ProgressPercent == 100);
        Assert.Contains(updates, item => item.ProgressPercent == 50 && item.IsRegression);
        Assert.Contains(updates, item => item.ProgressPercent == 25);
        Assert.Equal(3, updates.Select(item => item.ObjectiveId).Distinct().Count());
    }
}
