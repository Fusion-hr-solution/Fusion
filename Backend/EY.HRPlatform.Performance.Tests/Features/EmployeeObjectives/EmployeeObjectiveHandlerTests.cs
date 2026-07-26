using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Commands;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.EmployeeObjectives;

public class EmployeeObjectiveHandlerTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(
        Guid TenantId,
        string DbName,
        Guid CycleId,
        string Slug,
        Guid EmployeeId,
        Guid StrategicObjectiveId);

    private static async Task<Seeded> SeedLaunchedAsync()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"employee-objectives-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var approverId = Guid.NewGuid();

        await using var seed = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = TestCycles.Create(tenantId, "FY26 Personal Objectives", PerformanceCycleType.Annual, Start, End);
        var strategic = cycle.AddStrategicObjective("Improve client delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", approverId, "Mia Manager", false, null)],
            Start.AddDays(1));
        seed.PerformanceCycles.Add(cycle);
        await seed.SaveChangesAsync();
        return new Seeded(tenantId, dbName, cycle.Id, cycle.Slug, employeeId, strategic.Id);
    }

    private static SaveEmployeeObjectiveRequest ValidObjective(Seeded seeded, int weight = 30)
        => new(
            "Improve delivery quality",
            null,
            ObjectiveAlignmentType.StrategicObjective,
            seeded.StrategicObjectiveId,
            weight,
            Start.AddDays(30),
            "Quantitative",
            "NPS",
            "60",
            "%",
            null);

    [Fact]
    public async Task MyCampaigns_ListsLaunchedCampaignsWhereUserIsFrozenParticipant()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new GetMyObjectivePlanCampaignsQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = seeded.EmployeeId });

        var result = await handler.Handle(new GetMyObjectivePlanCampaignsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var campaign = Assert.Single(result.Value);
        Assert.Equal(seeded.CycleId, campaign.Id);
        Assert.Equal(0, campaign.ObjectiveCount);
    }

    [Fact]
    public async Task Workspace_GetOrCreate_IsIdempotentForOpenParticipant()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var guard = new EmployeeObjectivePlanAccessGuard(db, user);
        var handler = new GetMyObjectivePlanWorkspaceQueryHandler(db, user, guard);

        var first = await handler.Handle(new GetMyObjectivePlanWorkspaceQuery(seeded.Slug), CancellationToken.None);
        var second = await handler.Handle(new GetMyObjectivePlanWorkspaceQuery(seeded.Slug), CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(second.IsSuccess);
        Assert.Equal("draft", first.Value.State);
        Assert.Equal(first.Value.Plan!.Id, second.Value.Plan!.Id);
        Assert.Equal(1, await db.EmployeeObjectivePlans.CountAsync());
    }

    [Fact]
    public async Task SaveObjective_NonParticipant_IsForbidden()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = Guid.NewGuid() };
        var handler = new SaveObjectiveCommandHandler(db, new EmployeeObjectivePlanAccessGuard(db, user), user);

        var result = await handler.Handle(
            new SaveObjectiveCommand(seeded.CycleId, null, null, ValidObjective(seeded)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("EmployeeObjectivePlan.NotParticipantForbidden", result.Error.Code);
    }

    [Fact]
    public async Task Submit_InvalidPlan_ReturnsBlockingReasonsAndKeepsDraft()
    {
        var seeded = await SeedLaunchedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var save = new SaveObjectiveCommandHandler(db, new EmployeeObjectivePlanAccessGuard(db, user), user);
        var saved = await save.Handle(
            new SaveObjectiveCommand(seeded.CycleId, null, null, ValidObjective(seeded, weight: 30)),
            CancellationToken.None);
        Assert.True(saved.IsSuccess);

        var submit = new SubmitObjectivePlanCommandHandler(db, new EmployeeObjectivePlanAccessGuard(db, user), user);
        var result = await submit.Handle(
            new SubmitObjectivePlanCommand(seeded.CycleId, saved.Value.Version),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Submitted);
        Assert.Contains(result.Value.BlockingReasons, reason => reason.Code == "Weight.TotalMustEqual100");
        Assert.Equal(PlanStatus.Draft, result.Value.Plan.Status);
    }

    [Fact]
    public async Task Submit_ValidPlan_SubmitsAndAudits()
    {
        var seeded = await SeedLaunchedAsync();

        await using (var seed = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var cycle = await seed.PerformanceCycles
                .Include(c => c.Participants)
                .Include(c => c.StrategicObjectives)
                .SingleAsync(c => c.Id == seeded.CycleId);
            var participant = cycle.Participants.Single(p => p.EmployeeId == seeded.EmployeeId);
            var strategic = cycle.StrategicObjectives.Single(o => o.Id == seeded.StrategicObjectiveId);
            var seededPlan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
            foreach (var weight in new[] { 30, 30, 20, 20 })
            {
                seededPlan.AddObjective(
                    cycle,
                    "Improve delivery quality",
                    ObjectiveAlignmentType.StrategicObjective,
                    strategic.Id,
                    strategic.Title,
                    weight,
                    Start.AddDays(30),
                    "Quantitative",
                    "NPS",
                    "60",
                    "%",
                    Start.AddDays(2));
            }

            seed.EmployeeObjectivePlans.Add(seededPlan);
            await seed.SaveChangesAsync();
        }

        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var plan = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync();
        var submit = new SubmitObjectivePlanCommandHandler(db, new EmployeeObjectivePlanAccessGuard(db, user), user);
        var result = await submit.Handle(
            new SubmitObjectivePlanCommand(seeded.CycleId, plan.Version),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.True(result.Value.Submitted);
        Assert.Equal(PlanStatus.Submitted, result.Value.Plan.Status);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(
            audit => audit.Action == PerformanceCycleAuditAction.EmployeeObjectivePlanSubmitted));
    }
}
