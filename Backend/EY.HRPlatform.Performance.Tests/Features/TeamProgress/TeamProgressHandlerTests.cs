using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Progress.Queries;
using EY.HRPlatform.Performance.Features.TeamProgress.Queries;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.TeamProgress;

public class TeamProgressHandlerTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(
        Guid TenantId,
        string DbName,
        Guid CycleId,
        string Slug,
        Guid EmployeeId,
        Guid ManagerEmployeeId,
        Guid OtherManagerEmployeeId);

    private static async Task<Seeded> SeedLockedApprovedAsync()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"team-progress-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();

        await using var seed = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = PerformanceCycle.CreateDraft(
            tenantId, "FY26 Team Progress", $"fy26-team-progress-{Guid.NewGuid():N}", 2026, null,
            Guid.NewGuid(), "Test Owner", Start, Start.AddDays(14), Start.AddDays(21), Start.AddDays(300),
            CampaignPlanningRulesSnapshot.Capture(5, "0.40,0.60", "Quantitative,Qualitative", Guid.NewGuid(), Start));
        var strategic = cycle.AddStrategicObjective("Grow delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", managerId, "Mia Manager", false, null)],
            Start.AddDays(1));

        var participant = cycle.Participants.Single();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        plan.AddObjective(cycle, "Improve delivery", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 60, Start.AddDays(30), "Quantitative", "NPS", "60", "%", Start.AddDays(2));
        plan.AddObjective(cycle, "Coach peers", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 40, Start.AddDays(30), "Qualitative", null, null, null, Start.AddDays(2),
            successCriteria: "Two mentees onboarded");
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        plan.Approve(new EmployeeObjectivePlanReviewActor(managerId, "Mia Manager"), Start.AddDays(4));
        cycle.LockPlanning(Guid.NewGuid(), "HR Admin", Start.AddDays(5));

        seed.PerformanceCycles.Add(cycle);
        seed.EmployeeObjectivePlans.Add(plan);
        await seed.SaveChangesAsync();

        return new Seeded(tenantId, dbName, cycle.Id, cycle.Slug, employeeId, managerId, otherManagerId);
    }

    private static GetTeamProgressWorkspaceQueryHandler Workspace(PerformanceDbContext db, Guid reviewerId)
        => new(db, new EffectiveReviewerResolver(db), new StubCurrentUserContext { EmployeeId = reviewerId });

    [Fact]
    public async Task Workspace_EffectiveReviewer_SeesAssignedParticipant()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);

        var result = await Workspace(db, seeded.ManagerEmployeeId)
            .Handle(new GetTeamProgressWorkspaceQuery(seeded.Slug), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var participant = Assert.Single(result.Value.Participants);
        Assert.Equal(seeded.EmployeeId, participant.EmployeeId);
        // No progress recorded yet: both objectives Not started → needs attention.
        Assert.True(participant.NeedsAttention);
        Assert.Equal(0, participant.WeightedProgressPercent);
    }

    [Fact]
    public async Task Workspace_UnassignedManager_SeesNoParticipants()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);

        var result = await Workspace(db, seeded.OtherManagerEmployeeId)
            .Handle(new GetTeamProgressWorkspaceQuery(seeded.Slug), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value.Participants);
    }

    [Fact]
    public async Task Reassignment_MovesVisibilityToNewReviewer()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
                seeded.TenantId, seeded.CycleId, seeded.EmployeeId,
                seeded.ManagerEmployeeId, "Mia Manager",
                seeded.OtherManagerEmployeeId, "Omar Other",
                "Manager left the team", Guid.NewGuid(), "HR Admin", Start.AddDays(6)));
            await db.SaveChangesAsync();
        }

        await using var read = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var prior = await Workspace(read, seeded.ManagerEmployeeId)
            .Handle(new GetTeamProgressWorkspaceQuery(seeded.Slug), CancellationToken.None);
        var current = await Workspace(read, seeded.OtherManagerEmployeeId)
            .Handle(new GetTeamProgressWorkspaceQuery(seeded.Slug), CancellationToken.None);

        Assert.Empty(prior.Value.Participants);
        Assert.Single(current.Value.Participants);
    }

    [Fact]
    public async Task ParticipantDetail_NonReviewer_IsForbidden()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new GetTeamProgressParticipantDetailQueryHandler(
            db,
            new EffectiveReviewerResolver(db),
            new ObjectiveProgressHistoryReader(db),
            new StubCurrentUserContext { EmployeeId = seeded.OtherManagerEmployeeId });

        var result = await handler.Handle(
            new GetTeamProgressParticipantDetailQuery(seeded.Slug, seeded.EmployeeId), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
    }
}
