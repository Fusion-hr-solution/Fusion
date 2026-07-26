using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Commands;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Dtos;
using EY.HRPlatform.Performance.Features.PlanApprovals;
using EY.HRPlatform.Performance.Features.PlanApprovals.Commands;
using EY.HRPlatform.Performance.Features.PlanApprovals.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.PlanApprovals;

public class PlanApprovalHandlerTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(
        Guid TenantId,
        string DbName,
        Guid CycleId,
        string Slug,
        Guid EmployeeId,
        Guid ManagerEmployeeId,
        Guid OtherManagerEmployeeId,
        Guid PlanId);

    private static async Task<Seeded> SeedSubmittedPlanAsync(bool selfApprover = false)
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"plan-approvals-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var managerId = selfApprover ? employeeId : Guid.NewGuid();
        var otherManagerId = Guid.NewGuid();

        await using var seed = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = TestCycles.Create(tenantId, "FY26 Personal Objectives", PerformanceCycleType.Annual, Start, End);
        var strategic = cycle.AddStrategicObjective("Improve client delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", managerId, "Mia Manager", false, null)],
            Start.AddDays(1));

        var participant = cycle.Participants.Single();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        foreach (var (title, weight) in new[] { ("Improve delivery quality", 30), ("Raise reliability", 30), ("Reduce rework", 20), ("Coach peers", 20) })
        {
            plan.AddObjective(
                cycle,
                title,
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
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);

        seed.PerformanceCycles.Add(cycle);
        seed.EmployeeObjectivePlans.Add(plan);
        await seed.SaveChangesAsync();

        return new Seeded(tenantId, dbName, cycle.Id, cycle.Slug, employeeId, managerId, otherManagerId, plan.Id);
    }

    [Fact]
    public async Task MyCampaigns_CountsSubmittedChangesRequestedAndApprovedPlans()
    {
        var seeded = await SeedSubmittedPlanAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId };
        var handler = new GetMyPlanApprovalCampaignsQueryHandler(db, user);

        var result = await handler.Handle(new GetMyPlanApprovalCampaignsQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var campaign = Assert.Single(result.Value);
        Assert.Equal(1, campaign.WaitingForReviewCount);
        Assert.Equal(0, campaign.ChangesRequestedCount);
        Assert.Equal(0, campaign.ApprovedCount);
    }

    [Fact]
    public async Task Workspace_FlagsSelfApproverRowsAsDataIssues()
    {
        var seeded = await SeedSubmittedPlanAsync(selfApprover: true);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var handler = new GetPlanApprovalWorkspaceQueryHandler(db, user);

        var result = await handler.Handle(new GetPlanApprovalWorkspaceQuery(seeded.Slug), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var plan = Assert.Single(result.Value.Plans);
        Assert.True(plan.IsSelfApprovalDataIssue);
        Assert.Equal(1, result.Value.DataIssueCount);
        Assert.Equal(0, result.Value.WaitingForReviewCount);
    }

    [Fact]
    public async Task Approve_ByFrozenApprover_ApprovesAndAudits()
    {
        var seeded = await SeedSubmittedPlanAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(plan => plan.Id == seeded.PlanId);
        var user = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };
        var handler = new ApproveObjectivePlanCommandHandler(db, new PlanApprovalAccessGuard(db, user), user);

        var result = await handler.Handle(
            new ApproveObjectivePlanCommand(seeded.CycleId, seeded.PlanId, current.Version),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(PlanStatus.Approved, result.Value.Status);
        Assert.Equal(seeded.ManagerEmployeeId, result.Value.ApprovingManagerEmployeeId);
        Assert.Contains(result.Value.ReviewHistory, item => item.Type == ReviewEventType.Approved);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(
            audit => audit.Action == PerformanceCycleAuditAction.EmployeeObjectivePlanApproved));
    }

    [Fact]
    public async Task RequestChanges_RequiresCommentAndReopensForEmployeeCorrection()
    {
        var seeded = await SeedSubmittedPlanAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(plan => plan.Id == seeded.PlanId);
        var user = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };
        var handler = new RequestObjectivePlanChangesCommandHandler(db, new PlanApprovalAccessGuard(db, user), user);

        var invalid = await handler.Handle(
            new RequestObjectivePlanChangesCommand(seeded.CycleId, seeded.PlanId, current.Version, " "),
            CancellationToken.None);
        Assert.True(invalid.IsFailure);

        var result = await handler.Handle(
            new RequestObjectivePlanChangesCommand(seeded.CycleId, seeded.PlanId, current.Version, "Add a stronger metric."),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(PlanStatus.ChangesRequested, result.Value.Status);
        Assert.Equal("Add a stronger metric.", result.Value.LastChangeRequestComment);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(
            audit => audit.Action == PerformanceCycleAuditAction.EmployeeObjectivePlanChangesRequested));
    }

    [Fact]
    public async Task NonApprover_IsDeniedAndCrossTenant_IsNotFound()
    {
        var seeded = await SeedSubmittedPlanAsync();

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var current = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(plan => plan.Id == seeded.PlanId);
            var user = new StubCurrentUserContext { EmployeeId = seeded.OtherManagerEmployeeId };
            var handler = new ApproveObjectivePlanCommandHandler(db, new PlanApprovalAccessGuard(db, user), user);

            var result = await handler.Handle(
                new ApproveObjectivePlanCommand(seeded.CycleId, seeded.PlanId, current.Version),
                CancellationToken.None);

            Assert.True(result.IsFailure);
            Assert.Equal("PlanApproval.NotFrozenApproverForbidden", result.Error.Code);
        }

        await using (var db = PerformanceTestContext.Create(Guid.NewGuid(), out _, seeded.DbName))
        {
            var user = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId };
            var handler = new ApproveObjectivePlanCommandHandler(db, new PlanApprovalAccessGuard(db, user), user);

            var result = await handler.Handle(
                new ApproveObjectivePlanCommand(seeded.CycleId, seeded.PlanId, 0),
                CancellationToken.None);

            Assert.True(result.IsFailure);
            Assert.Contains("NotFound", result.Error.Code);
        }
    }

    [Fact]
    public async Task SelfApprover_CommandIsRejectedAsDataIssue()
    {
        var seeded = await SeedSubmittedPlanAsync(selfApprover: true);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var current = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(plan => plan.Id == seeded.PlanId);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var handler = new ApproveObjectivePlanCommandHandler(db, new PlanApprovalAccessGuard(db, user), user);

        var result = await handler.Handle(
            new ApproveObjectivePlanCommand(seeded.CycleId, seeded.PlanId, current.Version),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("PlanApproval.SelfApprovalDataIssue", result.Error.Code);
    }

    [Fact]
    public async Task RequestChanges_EmployeeEditsAndResubmitsWithP14Validation()
    {
        var seeded = await SeedSubmittedPlanAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var manager = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };
        var current = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(plan => plan.Id == seeded.PlanId);
        var requestChanges = new RequestObjectivePlanChangesCommandHandler(db, new PlanApprovalAccessGuard(db, manager), manager);
        var returned = await requestChanges.Handle(
            new RequestObjectivePlanChangesCommand(seeded.CycleId, seeded.PlanId, current.Version, "Fix the total weight."),
            CancellationToken.None);
        Assert.True(returned.IsSuccess);

        var employee = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId, FullName = "Alice Employee" };
        var employeeGuard = new EmployeeObjectivePlanAccessGuard(db, employee);
        var save = new SaveObjectiveCommandHandler(db, employeeGuard, employee);
        var editedInvalid = await save.Handle(
            new SaveObjectiveCommand(
                seeded.CycleId,
                returned.Value.Objectives.First().Id,
                returned.Value.Version,
                ValidObjective(returned.Value.Objectives.First().AlignmentTargetId!.Value, weight: 30, targetValue: null)),
            CancellationToken.None);
        Assert.True(editedInvalid.IsSuccess);

        var submit = new SubmitObjectivePlanCommandHandler(db, employeeGuard, employee);
        var blocked = await submit.Handle(
            new SubmitObjectivePlanCommand(seeded.CycleId, editedInvalid.Value.Version),
            CancellationToken.None);
        Assert.True(blocked.IsSuccess);
        Assert.False(blocked.Value.Submitted);
        Assert.Equal(PlanStatus.ChangesRequested, blocked.Value.Plan.Status);
        Assert.Contains(blocked.Value.BlockingReasons, reason => reason.Code == "Objective.TargetValueRequired");

        var editedValid = await save.Handle(
            new SaveObjectiveCommand(
                seeded.CycleId,
                returned.Value.Objectives.First().Id,
                blocked.Value.Plan.Version,
                ValidObjective(returned.Value.Objectives.First().AlignmentTargetId!.Value, weight: 30, targetValue: "65")),
            CancellationToken.None);
        Assert.True(editedValid.IsSuccess);

        var resubmitted = await submit.Handle(
            new SubmitObjectivePlanCommand(seeded.CycleId, editedValid.Value.Version),
            CancellationToken.None);

        Assert.True(resubmitted.IsSuccess);
        Assert.True(resubmitted.Value.Submitted);
        Assert.Equal(PlanStatus.Submitted, resubmitted.Value.Plan.Status);
        Assert.Contains(resubmitted.Value.Plan.ReviewHistory, item => item.Type == ReviewEventType.Resubmitted);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(
            audit => audit.Action == PerformanceCycleAuditAction.EmployeeObjectivePlanResubmitted));
    }

    private static SaveEmployeeObjectiveRequest ValidObjective(Guid strategicObjectiveId, int weight = 30, string? targetValue = "60")
        => new(
            "Improve delivery quality",
            null,
            ObjectiveAlignmentType.StrategicObjective,
            strategicObjectiveId,
            weight,
            Start.AddDays(30),
            "Quantitative",
            "NPS",
            targetValue,
            "%",
            null);
}
