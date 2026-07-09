using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Exceptions;

public sealed class ExceptionCaseWorkflowServiceTests
{
    [Fact]
    public async Task OpenOrReuse_CreatesCaseAndResolutionTask()
    {
        var tenantId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateActiveCycle(tenantId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var service = new ExceptionCaseWorkflowService(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await service.OpenOrReuseAsync(
            new OpenExceptionCaseRequest(
                cycle.Id,
                Guid.NewGuid(),
                CampaignWorkItemType.TeamObjectiveApproval,
                Guid.NewGuid(),
                "Routing failed",
                "route-failed",
                new { ObjectiveId = Guid.NewGuid() },
                now.AddDays(2)),
            CancellationToken.None);

        Assert.Equal(ExceptionCaseStatus.Open, result.Status);
        Assert.NotNull(result.CurrentResolutionWorkItemId);
        Assert.Single(db.ExceptionCases);
        Assert.Single(db.CampaignWorkItems.Where(item => item.Type == CampaignWorkItemType.ExceptionResolution));
    }

    [Fact]
    public async Task OpenOrReuse_ReusesExistingOpenCase()
    {
        var tenantId = Guid.NewGuid();
        var sourceWorkItemId = Guid.NewGuid();
        var sourceObjectId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = CreateActiveCycle(tenantId, now);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var service = new ExceptionCaseWorkflowService(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        await service.OpenOrReuseAsync(
            new OpenExceptionCaseRequest(cycle.Id, sourceWorkItemId, CampaignWorkItemType.TeamObjectiveApproval, sourceObjectId, "Routing failed", "route-failed", new { }, now.AddDays(2)),
            CancellationToken.None);
        var reused = await service.OpenOrReuseAsync(
            new OpenExceptionCaseRequest(cycle.Id, sourceWorkItemId, CampaignWorkItemType.TeamObjectiveApproval, sourceObjectId, "Routing failed again", "route-failed", new { Attempt = 2 }, now.AddDays(2)),
            CancellationToken.None);

        Assert.Single(db.ExceptionCases);
        Assert.Equal(2, db.ExceptionCaseHistoryEntries.Count(entry => entry.ExceptionCaseId == reused.Id));
    }

    private static PerformanceCycle CreateActiveCycle(Guid tenantId, DateTime now)
    {
        var ownerId = Guid.NewGuid();
        var cycle = TestCycles.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), true, 3, CampaignFeedbackVisibility.AnonymousToSubject, [ownerId]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }
}
