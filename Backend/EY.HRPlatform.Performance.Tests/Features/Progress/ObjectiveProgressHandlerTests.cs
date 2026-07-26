using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.ActivityLog;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Features.EmployeeObjectives.Queries;
using EY.HRPlatform.Performance.Features.Progress;
using EY.HRPlatform.Performance.Features.Progress.Commands;
using EY.HRPlatform.Performance.Features.Progress.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using System.Reflection;

namespace EY.HRPlatform.Performance.Tests.Features.Progress;

public class ObjectiveProgressHandlerTests
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
        Guid PlanId,
        Guid ObjectiveAId,
        Guid ObjectiveBId);

    /// <summary>Launched campaign, approved two-objective plan (weights 60/40), planning locked.</summary>
    private static async Task<Seeded> SeedLockedApprovedAsync()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"objective-progress-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        await using var seed = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            "FY26 Progress",
            $"fy26-progress-{Guid.NewGuid():N}",
            2026,
            null,
            Guid.NewGuid(),
            "Test Owner",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(300),
            CampaignPlanningRulesSnapshot.Capture(
                5, "0.40,0.60", "Quantitative,Qualitative", Guid.NewGuid(), Start));
        var strategic = cycle.AddStrategicObjective("Grow delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", managerId, "Mia Manager", false, null)],
            Start.AddDays(1));

        var participant = cycle.Participants.Single();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        var a = plan.AddObjective(cycle, "Improve delivery quality", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 60, Start.AddDays(30), "Quantitative", "NPS", "60", "%", Start.AddDays(2));
        var b = plan.AddObjective(cycle, "Coach peers", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 40, Start.AddDays(30), "Qualitative", null, null, null, Start.AddDays(2),
            successCriteria: "Two mentees onboarded");
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        plan.Approve(new EmployeeObjectivePlanReviewActor(managerId, "Mia Manager"), Start.AddDays(4));
        cycle.LockPlanning(Guid.NewGuid(), "HR Admin", Start.AddDays(5));

        seed.PerformanceCycles.Add(cycle);
        seed.EmployeeObjectivePlans.Add(plan);
        await seed.SaveChangesAsync();

        return new Seeded(tenantId, dbName, cycle.Id, cycle.Slug, employeeId, managerId, plan.Id, a.Id, b.Id);
    }

    private static async Task<uint> PlanVersionAsync(PerformanceDbContext db, Guid planId)
        => (await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(p => p.Id == planId)).Version;

    private static RecordObjectiveProgressRequest Record(int percent, string? comment = null,
        bool confirm = false, string? reason = null, string? actual = null)
        => new(percent, actual, comment, confirm, reason, null);

    [Fact]
    public async Task Record_ValidProgress_PersistsAppendOnlyAndComputesWeighted()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var handler = new RecordObjectiveProgressCommandHandler(
            db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);

        var v0 = await PlanVersionAsync(db, seeded.PlanId);
        var first = await handler.Handle(
            new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, v0, Record(50)),
            CancellationToken.None);

        Assert.True(first.IsSuccess);
        Assert.True(first.Value.Recorded);
        Assert.Equal(RecordObjectiveProgressOutcomes.Recorded, first.Value.Outcome);
        Assert.Equal(50, first.Value.Update!.ProgressPercent);
        // Weighted: 60*50/100 + 40*0/100 = 30
        Assert.Equal(30, first.Value.Progress!.WeightedProgressPercent);
        Assert.Equal(1, await db.ObjectiveProgressUpdates.CountAsync());
    }

    [Fact]
    public async Task Record_PercentOutOfRange_IsBlockedWithoutPersisting()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName);
        var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var handler = new RecordObjectiveProgressCommandHandler(
            db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);

        var v0 = await PlanVersionAsync(db, seeded.PlanId);
        var result = await handler.Handle(
            new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, v0, Record(150)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.False(result.Value.Recorded);
        Assert.Equal(RecordObjectiveProgressOutcomes.Blocked, result.Value.Outcome);
        Assert.Contains(result.Value.BlockingReasons, r => r.Code == "Progress.PercentOutOfRange");
        Assert.Equal(0, await db.ObjectiveProgressUpdates.CountAsync());
    }

    [Fact]
    public async Task Record_LowerValueWithoutReason_IsBlocked_ThenConfirmedReopens()
    {
        var seeded = await SeedLockedApprovedAsync();

        // First reach 100% (completed).
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName))
        {
            var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
            var handler = new RecordObjectiveProgressCommandHandler(
                db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);
            var v0 = await PlanVersionAsync(db, seeded.PlanId);
            var complete = await handler.Handle(
                new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, v0, Record(100)),
                CancellationToken.None);
            Assert.True(complete.Value.Recorded);
        }

        // A lower value without a reason is blocked.
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName))
        {
            var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
            var handler = new RecordObjectiveProgressCommandHandler(
                db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);
            var v = await PlanVersionAsync(db, seeded.PlanId);
            var blocked = await handler.Handle(
                new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, v, Record(40)),
                CancellationToken.None);
            Assert.False(blocked.Value.Recorded);
            Assert.Contains(blocked.Value.BlockingReasons, r => r.Code == "Progress.RegressionReasonRequired"
                || r.Code == "Progress.RegressionConfirmationRequired");
        }

        // Confirmed with a reason reopens the objective and traces the regression.
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName))
        {
            var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
            var handler = new RecordObjectiveProgressCommandHandler(
                db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);
            var v = await PlanVersionAsync(db, seeded.PlanId);
            var reopened = await handler.Handle(
                new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, v,
                    Record(40, confirm: true, reason: "Client scope changed")),
                CancellationToken.None);
            Assert.True(reopened.Value.Recorded);
            Assert.True(reopened.Value.Update!.IsRegression);
            Assert.Equal(100, reopened.Value.Update.PreviousPercent);
            var stateA = reopened.Value.Progress!.Objectives.Single(o => o.ObjectiveId == seeded.ObjectiveAId);
            Assert.Equal(ObjectiveProgressRules.StateInProgress, stateA.State);
        }
    }

    [Fact]
    public async Task Record_NonOwner_IsForbidden()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName);
        var stranger = new StubCurrentUserContext { EmployeeId = Guid.NewGuid() };
        var handler = new RecordObjectiveProgressCommandHandler(
            db, new EmployeeObjectivePlanAccessGuard(db, stranger), new ActivityLogWriter(db, tenant, stranger), stranger);

        var result = await handler.Handle(
            new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, 0, Record(50)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code);
        Assert.Equal(0, await db.ObjectiveProgressUpdates.CountAsync());
    }

    [Fact]
    public async Task Record_MissingActorUserId_IsForbiddenWithoutWriting()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName);
        var user = new StubCurrentUserContext { UserId = null, EmployeeId = seeded.EmployeeId };
        var handler = new RecordObjectiveProgressCommandHandler(
            db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);

        var result = await handler.Handle(
            new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, 0, Record(50)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("ActorRequired", result.Error.Code);
        Assert.Empty(await db.ObjectiveProgressUpdates.ToListAsync());
    }

    [Fact]
    public async Task Record_SameVersionSecondWrite_ReturnsRetryableConflictWithRefreshedVersion()
    {
        var seeded = await SeedLockedApprovedAsync();
        uint originalVersion;

        await using (var firstDb = PerformanceTestContext.Create(seeded.TenantId, out var firstTenant, seeded.DbName))
        {
            var firstUser = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
            var firstHandler = new RecordObjectiveProgressCommandHandler(
                firstDb,
                new EmployeeObjectivePlanAccessGuard(firstDb, firstUser),
                new ActivityLogWriter(firstDb, firstTenant, firstUser),
                firstUser);
            originalVersion = await PlanVersionAsync(firstDb, seeded.PlanId);

            var first = await firstHandler.Handle(
                new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, originalVersion, Record(25)),
                CancellationToken.None);

            Assert.True(first.IsSuccess);
            Assert.True(first.Value.Recorded);
        }

        // The in-memory provider does not advance PostgreSQL xmin. Advance the concurrency token
        // explicitly to model the version produced by the first committed request.
        var refreshedVersion = originalVersion + 1;
        await using (var versionDb = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var plan = await versionDb.EmployeeObjectivePlans.SingleAsync(item => item.Id == seeded.PlanId);
            typeof(EmployeeObjectivePlan)
                .GetProperty(nameof(EmployeeObjectivePlan.Version), BindingFlags.Public | BindingFlags.Instance)!
                .SetValue(plan, refreshedVersion);
            await versionDb.SaveChangesAsync();
        }

        await using var secondDb = PerformanceTestContext.Create(seeded.TenantId, out var secondTenant, seeded.DbName);
        var secondUser = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
        var secondHandler = new RecordObjectiveProgressCommandHandler(
            secondDb,
            new EmployeeObjectivePlanAccessGuard(secondDb, secondUser),
            new ActivityLogWriter(secondDb, secondTenant, secondUser),
            secondUser);

        var second = await secondHandler.Handle(
            new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveBId, originalVersion, Record(40)),
            CancellationToken.None);

        Assert.True(second.IsSuccess);
        Assert.False(second.Value.Recorded);
        Assert.Equal(RecordObjectiveProgressOutcomes.Conflict, second.Value.Outcome);
        Assert.True(second.Value.Retryable);
        Assert.Equal(refreshedVersion, second.Value.PlanVersion);
        Assert.Single(await secondDb.ObjectiveProgressUpdates.ToListAsync());
    }

    [Fact]
    public async Task Record_Success_AttributesNonEmptyActor()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName);
        var actorUserId = Guid.NewGuid();
        var user = new StubCurrentUserContext
        {
            UserId = actorUserId,
            EmployeeId = seeded.EmployeeId,
            FullName = "Alice Employee"
        };
        var handler = new RecordObjectiveProgressCommandHandler(
            db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);

        var result = await handler.Handle(
            new RecordObjectiveProgressCommand(
                seeded.CycleId,
                seeded.ObjectiveAId,
                await PlanVersionAsync(db, seeded.PlanId),
                Record(50)),
            CancellationToken.None);

        Assert.True(result.Value.Recorded);
        var update = await db.ObjectiveProgressUpdates.SingleAsync();
        Assert.Equal(actorUserId, update.ActorUserId);
        Assert.False(string.IsNullOrWhiteSpace(update.ActorName));
    }

    [Fact]
    public async Task Workspace_LockedApproved_ExposesProgressAndHistory()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out var tenant, seeded.DbName))
        {
            var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
            var handler = new RecordObjectiveProgressCommandHandler(
                db, new EmployeeObjectivePlanAccessGuard(db, user), new ActivityLogWriter(db, tenant, user), user);
            var v0 = await PlanVersionAsync(db, seeded.PlanId);
            await handler.Handle(
                new RecordObjectiveProgressCommand(seeded.CycleId, seeded.ObjectiveAId, v0,
                    Record(100, comment: "Shipped")),
                CancellationToken.None);
        }

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var user = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId };
            var guard = new EmployeeObjectivePlanAccessGuard(db, user);
            var handler = new GetMyObjectivePlanWorkspaceQueryHandler(db, user, guard);

            var result = await handler.Handle(new GetMyObjectivePlanWorkspaceQuery(seeded.Slug), CancellationToken.None);

            Assert.True(result.IsSuccess);
            Assert.Equal("locked-approved", result.Value.State);
            Assert.NotNull(result.Value.Progress);
            // 60*100/100 + 40*0/100 = 60
            Assert.Equal(60, result.Value.Progress!.WeightedProgressPercent);
            Assert.Equal(1, result.Value.Progress.CompletedObjectiveCount);
            Assert.Single(result.Value.ProgressHistory);
        }
    }
}
