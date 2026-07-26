using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CheckIns;
using EY.HRPlatform.Performance.Features.CheckIns.Commands;
using EY.HRPlatform.Performance.Features.CheckIns.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests.Features.CheckIns;

/// <summary>
/// Handler-level coverage for the check-in workflow: reviewer scope enforcement, reviewer continuity
/// across a reassignment, and optimistic-concurrency conflict mapping. Domain lifecycle and
/// immutability are covered by the Domain.*Tests siblings.
/// </summary>
public class CheckInHandlerTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private sealed record Seeded(
        Guid TenantId,
        string DbName,
        Guid CycleId,
        Guid EmployeeId,
        Guid ManagerEmployeeId,
        Guid ObjectiveAId);

    /// <summary>Launched campaign, approved single-objective plan, planning locked.</summary>
    private static async Task<Seeded> SeedLockedApprovedAsync()
    {
        var tenantId = Guid.NewGuid();
        var dbName = $"check-in-{Guid.NewGuid()}";
        var employeeId = Guid.NewGuid();
        var managerId = Guid.NewGuid();

        await using var seed = PerformanceTestContext.Create(tenantId, out _, dbName);
        var cycle = PerformanceCycle.CreateDraft(
            tenantId,
            "FY26 Check-ins",
            $"fy26-checkins-{Guid.NewGuid():N}",
            2026,
            null,
            Guid.NewGuid(),
            "Test Owner",
            Start,
            Start.AddDays(14),
            Start.AddDays(21),
            Start.AddDays(300),
            CampaignPlanningRulesSnapshot.Capture(5, "1.00", "Quantitative,Qualitative", Guid.NewGuid(), Start));
        var strategic = cycle.AddStrategicObjective("Grow delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", managerId, "Mia Manager", false, null)],
            Start.AddDays(1));

        var participant = cycle.Participants.Single();
        var plan = EmployeeObjectivePlan.CreateDraft(cycle, participant, Start.AddDays(2));
        var a = plan.AddObjective(cycle, "Improve delivery quality", ObjectiveAlignmentType.StrategicObjective,
            strategic.Id, strategic.Title, 100, Start.AddDays(30), "Quantitative", "NPS", "60", "%", Start.AddDays(2));
        Assert.True(plan.Submit(cycle, participant, Start.AddDays(3)).Succeeded);
        plan.Approve(new EmployeeObjectivePlanReviewActor(managerId, "Mia Manager"), Start.AddDays(4));
        cycle.LockPlanning(Guid.NewGuid(), "HR Admin", Start.AddDays(5));

        seed.PerformanceCycles.Add(cycle);
        seed.EmployeeObjectivePlans.Add(plan);
        await seed.SaveChangesAsync();

        return new Seeded(tenantId, dbName, cycle.Id, employeeId, managerId, a.Id);
    }

    private static PlanCheckInRequest PlanRequest(Guid employeeId, Guid? objectiveId = null)
        => new(
            employeeId,
            Start.AddDays(40),
            "10:00",
            "Mid-cycle progress",
            "Review delivery",
            objectiveId is { } id ? [id] : null,
            null);

    [Fact]
    public async Task PlanCheckIn_ByEffectiveReviewer_Succeeds()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var reviewer = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };
        var handler = new PlanCheckInCommandHandler(db, new CheckInAccessGuard(db, reviewer), reviewer);

        var result = await handler.Handle(
            new PlanCheckInCommand(seeded.CycleId, PlanRequest(seeded.EmployeeId, seeded.ObjectiveAId)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(CheckInStatus.Planned, result.Value.Status);
        Assert.Equal(1, await db.PerformanceCheckIns.CountAsync());
    }

    [Fact]
    public async Task PlanCheckIn_ByNonReviewer_IsForbidden()
    {
        var seeded = await SeedLockedApprovedAsync();
        await using var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName);
        var stranger = new StubCurrentUserContext { EmployeeId = Guid.NewGuid(), FullName = "Bob Bystander" };
        var handler = new PlanCheckInCommandHandler(db, new CheckInAccessGuard(db, stranger), stranger);

        var result = await handler.Handle(
            new PlanCheckInCommand(seeded.CycleId, PlanRequest(seeded.EmployeeId)),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("CheckIn.NotReviewerForbidden", result.Error.Code);
        Assert.Equal(0, await db.PerformanceCheckIns.CountAsync());
    }

    [Fact]
    public async Task PlanCheckIn_AfterReassignment_OnlyNewReviewerCanPlan()
    {
        var seeded = await SeedLockedApprovedAsync();
        var newReviewerId = Guid.NewGuid();

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            db.PerformanceCycleApproverReassignments.Add(PerformanceCycleApproverReassignment.Create(
                seeded.TenantId, seeded.CycleId, seeded.EmployeeId,
                seeded.ManagerEmployeeId, "Mia Manager",
                newReviewerId, "Nour NewManager",
                "Manager left the team", Guid.NewGuid(), "HR Admin", Start.AddDays(10)));
            await db.SaveChangesAsync();
        }

        // The frozen approver can no longer plan.
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var oldReviewer = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };
            var handler = new PlanCheckInCommandHandler(db, new CheckInAccessGuard(db, oldReviewer), oldReviewer);
            var result = await handler.Handle(
                new PlanCheckInCommand(seeded.CycleId, PlanRequest(seeded.EmployeeId)),
                CancellationToken.None);
            Assert.True(result.IsFailure);
            Assert.Equal("CheckIn.NotReviewerForbidden", result.Error.Code);
        }

        // The current effective reviewer can.
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var newReviewer = new StubCurrentUserContext { EmployeeId = newReviewerId, FullName = "Nour NewManager" };
            var handler = new PlanCheckInCommandHandler(db, new CheckInAccessGuard(db, newReviewer), newReviewer);
            var result = await handler.Handle(
                new PlanCheckInCommand(seeded.CycleId, PlanRequest(seeded.EmployeeId)),
                CancellationToken.None);
            Assert.True(result.IsSuccess);
            var checkIn = await db.PerformanceCheckIns.AsNoTracking().SingleAsync();
            Assert.Equal(newReviewerId, checkIn.CreatedByReviewerId);
            Assert.Equal("Reassigned", checkIn.ReviewerRelationship);
        }
    }

    [Fact]
    public async Task CompleteCheckIn_WithStaleVersion_ReturnsConflict()
    {
        var seeded = await SeedLockedApprovedAsync();
        var reviewer = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };

        Guid checkInId;
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var plan = new PlanCheckInCommandHandler(db, new CheckInAccessGuard(db, reviewer), reviewer);
            var planned = await plan.Handle(
                new PlanCheckInCommand(seeded.CycleId, PlanRequest(seeded.EmployeeId)), CancellationToken.None);
            checkInId = planned.Value.CheckInId;
        }

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var complete = new CompleteCheckInCommandHandler(db, new CheckInAccessGuard(db, reviewer));
            var result = await complete.Handle(
                new CompleteCheckInCommand(checkInId, new CompleteCheckInRequest(
                    ExpectedVersion: 999, Summary: "We talked.", DiscussedObjectiveIds: null, Actions: null)),
                CancellationToken.None);

            Assert.True(result.IsFailure);
            Assert.Equal("CheckIn.ConcurrentUpdate", result.Error.Code);
            var checkIn = await db.PerformanceCheckIns.AsNoTracking().SingleAsync(c => c.Id == checkInId);
            Assert.Equal(CheckInStatus.Planned, checkIn.Status);
        }
    }

    [Fact]
    public async Task CompleteFollowUpAction_WithStaleVersion_ReturnsConflict()
    {
        var seeded = await SeedLockedApprovedAsync();
        var reviewer = new StubCurrentUserContext { EmployeeId = seeded.ManagerEmployeeId, FullName = "Mia Manager" };

        Guid actionId;
        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var plan = new PlanCheckInCommandHandler(db, new CheckInAccessGuard(db, reviewer), reviewer);
            var planned = await plan.Handle(
                new PlanCheckInCommand(seeded.CycleId, PlanRequest(seeded.EmployeeId)), CancellationToken.None);
            var checkInId = planned.Value.CheckInId;

            var complete = new CompleteCheckInCommandHandler(db, new CheckInAccessGuard(db, reviewer));
            await complete.Handle(
                new CompleteCheckInCommand(checkInId, new CompleteCheckInRequest(
                    ExpectedVersion: planned.Value.Version,
                    Summary: "We talked.",
                    DiscussedObjectiveIds: null,
                    Actions:
                    [
                        new AgreedActionInput(
                            "Share the delivery plan", FollowUpActionOwnerKind.Employee, Start.AddDays(50), null)
                    ])),
                CancellationToken.None);
            actionId = await db.CheckInFollowUpActions.AsNoTracking().Select(a => a.Id).SingleAsync();
        }

        await using (var db = PerformanceTestContext.Create(seeded.TenantId, out _, seeded.DbName))
        {
            var employee = new StubCurrentUserContext { EmployeeId = seeded.EmployeeId, FullName = "Alice Employee" };
            var handler = new CompleteFollowUpActionCommandHandler(db, new CheckInAccessGuard(db, employee), employee);
            var result = await handler.Handle(
                new CompleteFollowUpActionCommand(actionId, new CompleteFollowUpActionRequest(ExpectedVersion: 999, Note: null)),
                CancellationToken.None);

            Assert.True(result.IsFailure);
            Assert.Equal("CheckIn.ActionConcurrentUpdate", result.Error.Code);
        }
    }
}
