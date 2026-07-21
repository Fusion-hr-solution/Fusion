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

        // End-to-end check-in walkthrough: a completed check-in on the setback objective, with a
        // resolved discussion signal, one completed employee action, one open reviewer action, and
        // the employee's single response.
        var checkIn = await db.PerformanceCheckIns
            .Include(item => item.LinkedObjectives)
            .SingleAsync(item => item.CycleId == cycle.Id);
        Assert.Equal(CheckInStatus.Completed, checkIn.Status);
        Assert.NotNull(checkIn.CompletionSummary);
        Assert.NotNull(checkIn.Response);
        Assert.Contains(checkIn.LinkedObjectives, item => item.WasDiscussed);

        var signal = await db.ObjectiveDiscussionSignals.SingleAsync(item => item.CycleId == cycle.Id);
        Assert.Equal(DiscussionSignalStatus.ResolvedByCheckIn, signal.Status);
        Assert.Equal(checkIn.Id, signal.ResolvedByCheckInId);

        var actions = await db.CheckInFollowUpActions
            .Where(item => item.CheckInId == checkIn.Id)
            .ToListAsync();
        Assert.Equal(2, actions.Count);
        Assert.Contains(actions, item => item.OwnerKind == FollowUpActionOwnerKind.Employee
            && item.Status == FollowUpActionStatus.Completed);
        Assert.Contains(actions, item => item.OwnerKind == FollowUpActionOwnerKind.Reviewer
            && item.Status == FollowUpActionStatus.Open);
    }
}
