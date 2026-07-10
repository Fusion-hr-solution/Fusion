using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.TeamObjectives.Commands;
using EY.HRPlatform.Performance.Features.TeamObjectives.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.TeamObjectives;

public class TeamObjectiveQueryTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private static PerformanceCycle NewLaunched(
        Guid tenantId,
        string name,
        Guid approverEmployeeId,
        string approverName = "Mia Manager",
        int scopeSize = 1)
    {
        var cycle = TestCycles.Create(tenantId, name, PerformanceCycleType.Annual, Start, End);
        cycle.AddStrategicObjective("Improve client delivery", "Raise quality", "Consulting");
        var baseline = Enumerable.Range(0, scopeSize)
            .Select(index => new ResolvedLaunchParticipant(
                Guid.NewGuid(), $"Report {index}", approverEmployeeId, approverName, false, null,
                OrgUnitName: index % 2 == 0 ? "Consulting" : "Audit"))
            .ToArray();
        cycle.Launch(baseline, Start.AddDays(1));
        return cycle;
    }

    [Fact]
    public async Task MyCampaigns_WithoutEmployeeContext_ReturnsEmptyWithoutError()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new GetMyTeamObjectiveCampaignsQueryHandler(db, new StubCurrentUserContext { EmployeeId = null });

        var result = await handler.Handle(new GetMyTeamObjectiveCampaignsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task MyCampaigns_ListsOnlyLaunchedCampaignsWithFrozenResponsibility()
    {
        var tenantId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var dbName = $"my-campaigns-{Guid.NewGuid()}";

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var mine = NewLaunched(tenantId, "Mine", managerId, scopeSize: 3);
            var someoneElses = NewLaunched(tenantId, "Not mine", Guid.NewGuid());
            var draft = TestCycles.Create(tenantId, "Still draft", PerformanceCycleType.Annual, Start, End);
            seed.PerformanceCycles.AddRange(mine, someoneElses, draft);
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetMyTeamObjectiveCampaignsQueryHandler(
            db, new StubCurrentUserContext { EmployeeId = managerId });

        var result = await handler.Handle(new GetMyTeamObjectiveCampaignsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var campaign = Assert.Single(result.Value);
        Assert.Equal("Mine", campaign.Name);
        Assert.Equal(3, campaign.ScopeParticipantCount);
        Assert.Equal(0, campaign.MyTeamObjectiveCount);
        Assert.NotNull(campaign.PlanningOpeningDate);
    }

    [Fact]
    public async Task Workspace_ForResponsibleManager_ReturnsStrategyScopeAndOwnObjectivesOnly()
    {
        var tenantId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();
        var dbName = $"workspace-{Guid.NewGuid()}";
        string slug;
        Guid cycleId;
        Guid activeStrategicId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var cycle = TestCycles.Create(tenantId, "FY26 Cascade", PerformanceCycleType.Annual, Start, End);
            var active = cycle.AddStrategicObjective("Improve client delivery", null, "Consulting");
            var inactive = cycle.AddStrategicObjective("Retired pillar", null, null);
            cycle.SetStrategicObjectiveActive(inactive.Id, false);
            cycle.Launch(
                [
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Alice", managerId, "Mia Manager", false, null, OrgUnitName: "Consulting"),
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Bob", managerId, "Mia Manager", false, null, OrgUnitName: "Consulting"),
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Cara", otherManagerId, "Omar Lead", false, null, OrgUnitName: "Audit")
                ],
                Start.AddDays(1));
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            slug = cycle.Slug;
            cycleId = cycle.Id;
            activeStrategicId = active.Id;
        }

        // Each manager saves one team objective.
        foreach (var (owner, name) in new[] { (managerId, "Mia Manager"), (otherManagerId, "Omar Lead") })
        {
            await using var writer = PerformanceTestContext.Create(tenantId, out _, dbName);
            var create = new CreateTeamObjectiveCommandHandler(
                writer, new StubCurrentUserContext { EmployeeId = owner, FullName = name });
            var created = await create.Handle(new CreateTeamObjectiveCommand(
                cycleId, activeStrategicId, $"{name}'s objective", "Done well", "Quantitative", null),
                CancellationToken.None);
            Assert.True(created.IsSuccess);
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetTeamObjectiveWorkspaceQueryHandler(
            db, new StubCurrentUserContext { EmployeeId = managerId });

        var result = await handler.Handle(new GetTeamObjectiveWorkspaceQuery(slug), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var workspace = result.Value;
        Assert.Equal(cycleId, workspace.CycleId);
        Assert.Equal(["Quantitative", "Qualitative"], workspace.EnabledMeasurementMethods);
        var strategy = Assert.Single(workspace.StrategicObjectives);
        Assert.Equal("Improve client delivery", strategy.Title);
        Assert.Equal(2, workspace.MyScope.ParticipantCount);
        Assert.Equal(["Consulting"], workspace.MyScope.OrgUnitNames);
        var objective = Assert.Single(workspace.MyTeamObjectives);
        Assert.Equal("Mia Manager's objective", objective.Title);
    }

    [Fact]
    public async Task Workspace_WithoutFrozenResponsibility_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"workspace-denied-{Guid.NewGuid()}";
        string slug;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var cycle = NewLaunched(tenantId, "FY26 Cascade", Guid.NewGuid());
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            slug = cycle.Slug;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetTeamObjectiveWorkspaceQueryHandler(
            db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new GetTeamObjectiveWorkspaceQuery(slug), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("TeamObjective.NotResponsibleForbidden", result.Error.Code);
    }

    [Fact]
    public async Task Coverage_OnDraftCampaign_IsRejectedAsNotLaunched()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"coverage-draft-{Guid.NewGuid()}";
        string slug;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var draft = TestCycles.Create(tenantId, "Still draft", PerformanceCycleType.Annual, Start, End);
            seed.PerformanceCycles.Add(draft);
            await seed.SaveChangesAsync();
            slug = draft.Slug;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetCascadeCoverageQueryHandler(db);

        var result = await handler.Handle(new GetCascadeCoverageQuery(slug), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("CascadeCoverage.NotLaunchedInvalid", result.Error.Code);
    }

    [Fact]
    public async Task Coverage_ComputesLiveCountsWithoutWriting()
    {
        var tenantId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();
        var dbName = $"coverage-{Guid.NewGuid()}";
        string slug;
        Guid cycleId;
        Guid coveredStrategicId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var cycle = TestCycles.Create(tenantId, "FY26 Cascade", PerformanceCycleType.Annual, Start, End);
            var covered = cycle.AddStrategicObjective("Improve client delivery", null, "Consulting");
            cycle.AddStrategicObjective("Uncovered pillar", null, null);
            cycle.AddStrategicObjective("Another uncovered pillar", null, null);
            cycle.Launch(
                [
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Alice", managerId, "Mia Manager", false, null),
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Bob", managerId, "Mia Manager", false, null),
                    new ResolvedLaunchParticipant(Guid.NewGuid(), "Cara", otherManagerId, "Omar Lead", false, null)
                ],
                Start.AddDays(1));
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            slug = cycle.Slug;
            cycleId = cycle.Id;
            coveredStrategicId = covered.Id;
        }

        // One manager creates two team objectives on the same strategic objective; the other none.
        foreach (var title in new[] { "First", "Second" })
        {
            await using var writer = PerformanceTestContext.Create(tenantId, out _, dbName);
            var create = new CreateTeamObjectiveCommandHandler(
                writer, new StubCurrentUserContext { EmployeeId = managerId, FullName = "Mia Manager" });
            var created = await create.Handle(new CreateTeamObjectiveCommand(
                cycleId, coveredStrategicId, title, "Done well", "Quantitative", null), CancellationToken.None);
            Assert.True(created.IsSuccess);
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var auditCountBefore = await db.PerformanceCycleAuditEvents.CountAsync();
        var handler = new GetCascadeCoverageQueryHandler(db);

        var result = await handler.Handle(new GetCascadeCoverageQuery(slug), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var coverage = result.Value;
        Assert.Equal(3, coverage.ActiveStrategicObjectiveCount);
        Assert.Equal(1, coverage.CoveredStrategicObjectiveCount);
        Assert.Equal(2, coverage.ManagerCount);
        Assert.Equal(1, coverage.ManagersWithTeamObjectivesCount);
        Assert.Equal(2, coverage.TeamObjectiveCount);
        Assert.Equal(2, coverage.StrategicObjectives.Single(o => o.Id == coveredStrategicId).TeamObjectiveCount);
        var mia = coverage.Managers.Single(m => m.Name == "Mia Manager");
        Assert.Equal(2, mia.ScopeSize);
        Assert.Equal(2, mia.TeamObjectiveCount);
        var omar = coverage.Managers.Single(m => m.Name == "Omar Lead");
        Assert.Equal(0, omar.TeamObjectiveCount);
        Assert.Equal(2, coverage.TeamObjectives.Count);

        // Reads never write: no audit facts or coverage state were persisted.
        Assert.Equal(auditCountBefore, await db.PerformanceCycleAuditEvents.CountAsync());
    }

    [Fact]
    public async Task CoverageCampaigns_ListsLaunchedCampaignsOnly()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"coverage-list-{Guid.NewGuid()}";

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            seed.PerformanceCycles.Add(NewLaunched(tenantId, "Launched one", Guid.NewGuid()));
            seed.PerformanceCycles.Add(TestCycles.Create(tenantId, "Still draft", PerformanceCycleType.Annual, Start, End));
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var handler = new GetCascadeCoverageCampaignsQueryHandler(db);

        var result = await handler.Handle(new GetCascadeCoverageCampaignsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var campaign = Assert.Single(result.Value);
        Assert.Equal("Launched one", campaign.Name);
    }
}
