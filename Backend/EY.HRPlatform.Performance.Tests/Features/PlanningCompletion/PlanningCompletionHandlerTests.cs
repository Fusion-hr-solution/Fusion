using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;
using EY.HRPlatform.Performance.Features.PlanApprovals;
using EY.HRPlatform.Performance.Features.PlanningCompletion;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Commands;
using EY.HRPlatform.Performance.Features.PlanningCompletion.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.PlanningCompletion;

public sealed class PlanningCompletionHandlerTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(
        Guid TenantId,
        string DbName,
        Guid CycleId,
        string Slug,
        Guid ApprovedEmployeeId,
        Guid PendingEmployeeId,
        Guid FrozenApproverId,
        Guid NewApproverId);

    [Fact]
    public async Task Exclusion_SatisfiesReadinessWithoutRewritingFrozenParticipant()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: true);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var workforce = Workforce(seeded);
        var readService = new PlanningCompletionReadService(db, workforce);
        var user = new StubCurrentUserContext { FullName = "HR Admin" };
        var handler = new ExcludePlanningParticipantCommandHandler(db, readService, user);

        var result = await handler.Handle(
            new ExcludePlanningParticipantCommand(
                seeded.CycleId,
                seeded.PendingEmployeeId,
                new ExcludePlanningParticipantRequest("Employee left after launch")),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal("excluded", result.Value.Participant.Status);
        Assert.Equal(2, await db.PerformanceCycleParticipants.CountAsync());
        var remaining = await readService.ValidateLockReadinessAsync(seeded.CycleId, CancellationToken.None);
        Assert.True(remaining.IsSuccess);
        Assert.Empty(remaining.Value);
    }

    [Fact]
    public async Task Exclusion_RequiresReason()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: true);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var readService = new PlanningCompletionReadService(db, Workforce(seeded));
        var handler = new ExcludePlanningParticipantCommandHandler(
            db,
            readService,
            new StubCurrentUserContext { FullName = "HR Admin" });

        var result = await handler.Handle(
            new ExcludePlanningParticipantCommand(
                seeded.CycleId,
                seeded.PendingEmployeeId,
                new ExcludePlanningParticipantRequest(" ")),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("PlanningCompletion.ExclusionReasonRequired", result.Error.Code);
        Assert.False(await db.PerformanceCycleParticipantExclusions.AnyAsync());
    }

    [Fact]
    public async Task Reminder_RecordsHistoryAndAuditWithoutRewritingPlan()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: false);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var readService = new PlanningCompletionReadService(db, Workforce(seeded));
        var handler = new RecordPlanningReminderCommandHandler(
            db,
            readService,
            new StubCurrentUserContext { FullName = "HR Admin" });
        var plan = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(p => p.EmployeeId == seeded.ApprovedEmployeeId);

        var result = await handler.Handle(
            new RecordPlanningReminderCommand(
                seeded.CycleId,
                new RecordPlanningReminderRequest(
                    seeded.ApprovedEmployeeId,
                    "Participant",
                    "Please submit corrections before the lock date.",
                    seeded.ApprovedEmployeeId,
                    plan.Id)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value.ReminderHistory);
        Assert.Equal(plan.Version, (await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(p => p.Id == plan.Id)).Version);
        Assert.True(await db.PerformancePlanningReminders.AnyAsync(item =>
            item.TargetEmployeeId == seeded.ApprovedEmployeeId &&
            item.Reason == "Please submit corrections before the lock date."));
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(item =>
            item.Action == PerformanceCycleAuditAction.PlanningReminderRecorded));
    }

    [Fact]
    public async Task Reminder_WithNotification_RecordsContextualDeepLink()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: false);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var handler = new RecordPlanningReminderCommandHandler(
            db,
            new PlanningCompletionReadService(db, Workforce(seeded)),
            new StubCurrentUserContext { FullName = "HR Admin" });

        var result = await handler.Handle(
            new RecordPlanningReminderCommand(
                seeded.CycleId,
                new RecordPlanningReminderRequest(
                    seeded.ApprovedEmployeeId,
                    "Participant",
                    "Please finish objective planning.",
                    seeded.ApprovedEmployeeId,
                    TriggerNotification: true)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var notification = await db.PerformanceNotifications.SingleAsync();
        Assert.Equal("PerformanceCycle", notification.SubjectType);
        Assert.Equal(seeded.CycleId, notification.SubjectId);
        Assert.Equal($"/campaigns/{seeded.Slug}/completion", notification.NavigationRoute);
    }

    [Fact]
    public async Task Reassignment_ChangesEffectiveReviewerWithoutChangingFrozenApprover()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: false);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var workforce = Workforce(seeded);
        var readService = new PlanningCompletionReadService(db, workforce);
        var hr = new StubCurrentUserContext { FullName = "HR Admin" };
        var handler = new ReassignPlanningReviewerCommandHandler(db, readService, workforce, hr);

        var reassigned = await handler.Handle(
            new ReassignPlanningReviewerCommand(
                seeded.CycleId,
                seeded.ApprovedEmployeeId,
                new ReassignPlanningReviewerRequest(seeded.NewApproverId, "Manager unavailable")),
            CancellationToken.None);

        Assert.True(reassigned.IsSuccess);
        Assert.Equal(seeded.NewApproverId, reassigned.Value.Participant.EffectiveReviewer.EmployeeId);
        Assert.Equal(seeded.FrozenApproverId, reassigned.Value.Participant.FrozenReviewer.EmployeeId);

        var plan = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(p => p.EmployeeId == seeded.ApprovedEmployeeId);
        var newReviewerGuard = new PlanApprovalAccessGuard(
            db,
            new StubCurrentUserContext { EmployeeId = seeded.NewApproverId });
        var newScope = await newReviewerGuard.RequirePlanApprovalScopeAsync(seeded.CycleId, plan.Id, CancellationToken.None);
        Assert.True(newScope.IsSuccess);

        var oldReviewerGuard = new PlanApprovalAccessGuard(
            db,
            new StubCurrentUserContext { EmployeeId = seeded.FrozenApproverId });
        var oldScope = await oldReviewerGuard.RequirePlanApprovalScopeAsync(seeded.CycleId, plan.Id, CancellationToken.None);
        Assert.True(oldScope.IsFailure);
    }

    [Fact]
    public async Task LockPlanning_RefusesWhileParticipantsRemainUnresolved()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: true);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var readService = new PlanningCompletionReadService(db, Workforce(seeded));
        var cycle = await db.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == seeded.CycleId);
        var handler = new LockPlanningCommandHandler(
            db,
            readService,
            new StubCurrentUserContext { FullName = "HR Admin" });

        var result = await handler.Handle(
            new LockPlanningCommand(seeded.CycleId, cycle.Version, new LockPlanningRequest("LOCK")),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("PlanningCompletion.NotReadyToLock", result.Error.Code);
        Assert.False((await db.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == seeded.CycleId)).IsPlanningLocked);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(a => a.Action == PerformanceCycleAuditAction.PlanningLockRejected));
    }

    [Fact]
    public async Task LockPlanning_WhenReady_LocksBaselineAndBlocksNormalP1Mutations()
    {
        var seeded = await SeedAsync(approvedFirstParticipant: true);
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var readService = new PlanningCompletionReadService(db, Workforce(seeded));
        var hr = new StubCurrentUserContext { FullName = "HR Admin" };
        var exclude = new ExcludePlanningParticipantCommandHandler(db, readService, hr);
        var excluded = await exclude.Handle(
            new ExcludePlanningParticipantCommand(
                seeded.CycleId,
                seeded.PendingEmployeeId,
                new ExcludePlanningParticipantRequest("Transferred before lock")),
            CancellationToken.None);
        Assert.True(excluded.IsSuccess);

        var cycleVersion = (await db.PerformanceCycles.AsNoTracking().SingleAsync(c => c.Id == seeded.CycleId)).Version;
        var lockHandler = new LockPlanningCommandHandler(db, readService, hr);
        var locked = await lockHandler.Handle(
            new LockPlanningCommand(seeded.CycleId, cycleVersion, new LockPlanningRequest("LOCK")),
            CancellationToken.None);

        Assert.True(locked.IsSuccess);
        Assert.Equal("locked", locked.Value.State);
        var cycle = await db.PerformanceCycles
            .Include(item => item.Participants)
            .SingleAsync(item => item.Id == seeded.CycleId);
        Assert.True(cycle.IsPlanningLocked);
        Assert.NotNull(cycle.PlanningLockedAt);
        Assert.True(await db.PerformanceCycleAuditEvents.AnyAsync(a => a.Action == PerformanceCycleAuditAction.PlanningLocked));

        var plan = await db.EmployeeObjectivePlans.AsNoTracking().SingleAsync(p => p.EmployeeId == seeded.ApprovedEmployeeId);
        var approvalGuard = new PlanApprovalAccessGuard(
            db,
            new StubCurrentUserContext { EmployeeId = seeded.FrozenApproverId });
        var approvalScope = await approvalGuard.RequirePlanApprovalScopeAsync(seeded.CycleId, plan.Id, CancellationToken.None);
        Assert.True(approvalScope.IsFailure);
        Assert.Equal("PlanApproval.Locked", approvalScope.Error.Code);

        var excludedParticipant = cycle.Participants.Single(item => item.EmployeeId == seeded.PendingEmployeeId);
        Assert.Throws<DomainRuleViolationException>(() =>
            EmployeeObjectivePlan.CreateDraft(cycle, excludedParticipant, Start.AddDays(10)));
    }

    private static async Task<Seeded> SeedAsync(bool approvedFirstParticipant)
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"planning-completion-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var pendingEmployeeId = Guid.NewGuid();
        var approverId = Guid.NewGuid();
        var newApproverId = Guid.NewGuid();

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = TestCycles.Create(tenantId, "FY26 Planning", PerformanceCycleType.Annual, Start, End);
        var strategic = cycle.AddStrategicObjective("Improve client delivery", null, "Consulting");
        cycle.Launch(
            [
                new ResolvedLaunchParticipant(employeeId, "Alice Employee", approverId, "Mia Manager", false, null),
                new ResolvedLaunchParticipant(pendingEmployeeId, "Bob Employee", approverId, "Mia Manager", false, null)
            ],
            Start.AddDays(1));
        db.PerformanceCycles.Add(cycle);

        var participant = cycle.Participants.Single(p => p.EmployeeId == employeeId);
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        for (var index = 1; index <= 5; index++)
        {
            plan.AddObjective(
                cycle,
                $"Improve delivery quality {index}",
                ObjectiveAlignmentType.StrategicObjective,
                strategic.Id,
                strategic.Title,
                20,
                Start.AddDays(30),
                "Quantitative",
                "NPS",
                "60",
                "%",
                Start.AddDays(2));
        }
        plan.Submit(cycle, participant, Start.AddDays(3));
        if (approvedFirstParticipant)
        {
            plan.Approve(new EmployeeObjectivePlanReviewActor(approverId, "Mia Manager"), Start.AddDays(4));
        }

        db.EmployeeObjectivePlans.Add(plan);
        await db.SaveChangesAsync();
        return new Seeded(tenantId, dbName, cycle.Id, cycle.Slug, employeeId, pendingEmployeeId, approverId, newApproverId);
    }

    private static FakeCoreWorkforceClient Workforce(Seeded seeded)
        => new()
        {
            ResolvePool =
            [
                Employee(seeded.FrozenApproverId, "Mia Manager", true),
                Employee(seeded.NewApproverId, "Nora Reviewer", true)
            ]
        };

    private static CoreEmployeeSummary Employee(Guid id, string name, bool active)
        => FakeCoreWorkforceClient.Employee(id, name) with { IsActive = active };
}
