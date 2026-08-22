using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Plans;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Chunk C — employee plan authoring, the whole-plan submission gate, manager decision, lock
/// immutability, and the governed exceptional-approval escape hatch. Exercises the handlers over
/// the shared in-memory store the way the API does (a fresh context per request).
/// </summary>
public sealed class EmployeePlansTests
{
    private static readonly DateOnly CycleStart = new(2026, 1, 1);
    private static readonly DateOnly CycleEnd = new(2026, 12, 31);

    private sealed record Fixture(
        TestStore Store,
        FakeCoreWorkforceClient Workforce,
        Guid CycleId,
        Guid StrategicId,
        Guid EmployeeId,
        Guid ManagerId,
        Guid ParticipantId);

    private static async Task<Fixture> ArrangeAsync(bool standaloneAllowed = true)
    {
        var store = TestStore.ForNewTenant();
        var workforce = new FakeCoreWorkforceClient();
        var coo = workforce.Add("Coralie Ops");
        var manager = workforce.Add("Mo Manager");
        var employee = workforce.Add("Emma Employee");

        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY2026", CycleStart, CycleEnd, CycleStart.AddDays(30));
        var strategic = Objective.CreateStrategic(store.TenantId, cycle.Id, "Grow the company", null, coo.EmployeeId,
            CycleStart, CycleEnd, ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd);
        strategic.Publish();

        var participant = Participant.Create(store.TenantId, cycle.Id, employee.EmployeeId, "Emma Employee", "Engineer",
            Guid.NewGuid(), "Engineering", manager.EmployeeId, "Mo Manager", byExplicitInclusion: false);

        await using (var db = store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Objectives.Add(strategic);
            db.Participants.Add(participant);
            db.CycleSettings.Add(SettingsWith(store.TenantId, standaloneAllowed));
            await db.SaveChangesAsync();

            var tracked = await db.Cycles.FirstAsync();
            var snapshot = ActivationSnapshot.Capture(store.TenantId, cycle.Id, "FY2026", CycleStart, CycleEnd, CycleStart.AddDays(30), CycleStart, 1, "{}", "{}", "[]", "[]");
            tracked.Activate(snapshot);
            db.Entry(snapshot).State = EntityState.Added;
            await db.SaveChangesAsync();
        }

        return new Fixture(store, workforce, cycle.Id, strategic.Id, employee.EmployeeId, manager.EmployeeId, participant.Id);
    }

    private static CycleSettings SettingsWith(Guid tenantId, bool standaloneAllowed)
    {
        var settings = CycleSettings.CreateDefault(tenantId);
        if (!standaloneAllowed)
            settings.Update(settings.DefaultMeasurementMethod, settings.SuggestedObjectiveCountMin, settings.SuggestedObjectiveCountMax, settings.PlanningDeadlineOffsetDays, allowStandaloneObjectives: false);
        return settings;
    }

    private static PlanActorContext Employee(Guid id) => new(id, IsAdmin: false, CanReviewReports: false);
    private static PlanActorContext Manager(Guid id) => new(id, IsAdmin: false, CanReviewReports: true);
    private static PlanActorContext Admin(Guid id) => new(id, IsAdmin: true, CanReviewReports: true);

    private static AddPlanObjectiveRequest AlignedNumeric(Guid parentId, decimal weight, string title = "Reduce escalation time")
        => new(title, null, parentId, null, null,
            new MeasurementInput(MeasurementMethod.NumericTarget, 24m, 12m, "hours", ImprovementDirection.Decrease, null), weight);

    private static AddPlanObjectiveRequest Standalone(decimal weight, string title = "Complete operational documentation")
        => new(title, null, null, null, null,
            new MeasurementInput(MeasurementMethod.ManualPercentage, null, null, null, null, null), weight);

    // ── Handler wiring ────────────────────────────────────────────────────

    private static async Task<EmployeePlanDto> CreatePlanAsync(Fixture f, PlanActorContext actor)
    {
        await using var db = f.Store.NewContext();
        var result = await new CreateMyPlanHandler(db, f.Workforce, f.Store.Tenant).Handle(new CreateMyPlanCommand(f.CycleId, actor), default);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        return result.Value;
    }

    private static async Task<Result<EmployeePlanDto>> AddObjectiveAsync(Fixture f, AddPlanObjectiveRequest request, PlanActorContext actor)
    {
        await using var db = f.Store.NewContext();
        return await new AddPlanObjectiveHandler(db, f.Workforce, f.Store.Tenant).Handle(new AddPlanObjectiveCommand(f.CycleId, request, actor), default);
    }

    private static async Task<Result<EmployeePlanDto>> SubmitAsync(Fixture f, PlanActorContext actor)
    {
        await using var db = f.Store.NewContext();
        return await new SubmitMyPlanHandler(db, f.Workforce, f.Store.Tenant).Handle(new SubmitMyPlanCommand(f.CycleId, actor), default);
    }

    // ── Authoring ownership & uniqueness ──────────────────────────────────

    [Fact]
    public async Task Second_competing_plan_for_the_same_participant_is_rejected()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));

        // A second create for the same participant returns the existing plan, never a competing one.
        var first = await LoadPlanIdAsync(f);
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        var second = await LoadPlanIdAsync(f);

        Assert.Equal(first, second);
        await using var db = f.Store.NewContext();
        Assert.Equal(1, await db.EmployeePlans.CountAsync(p => p.CycleId == f.CycleId && p.EmployeeId == f.EmployeeId));
    }

    [Fact]
    public async Task Manager_cannot_author_into_the_employee_plan()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));

        // Authoring is self-scoped: the add endpoint only ever targets the caller's own plan, so a
        // manager cannot reach the employee's plan to insert an objective, and the employee's plan is
        // left untouched.
        var result = await AddObjectiveAsync(f, AlignedNumeric(f.StrategicId, 100m), Manager(f.ManagerId));
        Assert.True(result.IsFailure);

        await using var db = f.Store.NewContext();
        Assert.Equal(0, await db.Objectives.CountAsync(o => o.EmployeePlanId != null));
    }

    // ── Submission gate ───────────────────────────────────────────────────

    [Fact]
    public async Task Plan_without_strategic_connection_cannot_submit()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        // One standalone objective worth 100% — no connection to strategic direction.
        Assert.True((await AddObjectiveAsync(f, Standalone(100m), Employee(f.EmployeeId))).IsSuccess);

        var submit = await SubmitAsync(f, Employee(f.EmployeeId));
        Assert.True(submit.IsFailure);
        Assert.Contains("strategic", submit.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Plan_weights_must_total_100_to_submit()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        Assert.True((await AddObjectiveAsync(f, AlignedNumeric(f.StrategicId, 60m), Employee(f.EmployeeId))).IsSuccess);

        // 60% only — under 100%.
        var under = await SubmitAsync(f, Employee(f.EmployeeId));
        Assert.True(under.IsFailure);

        var last = (await AddObjectiveAsync(f, Standalone(40m), Employee(f.EmployeeId))).Value;
        Assert.Equal(100m, last.Readiness.WeightTotal);
        Assert.True(last.Readiness.CanSubmit);

        var ok = await SubmitAsync(f, Employee(f.EmployeeId));
        Assert.True(ok.IsSuccess, ok.IsFailure ? ok.Error.Message : null);
        Assert.Equal(PlanLifecycleState.Submitted, ok.Value.State);
    }

    [Fact]
    public async Task Standalone_objective_is_rejected_when_policy_disables_it()
    {
        var f = await ArrangeAsync(standaloneAllowed: false);
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        Assert.True((await AddObjectiveAsync(f, AlignedNumeric(f.StrategicId, 60m), Employee(f.EmployeeId))).IsSuccess);
        Assert.True((await AddObjectiveAsync(f, Standalone(40m), Employee(f.EmployeeId))).IsSuccess);

        var submit = await SubmitAsync(f, Employee(f.EmployeeId));
        Assert.True(submit.IsFailure);
        Assert.Contains("standalone", submit.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    // ── Manager decision & lock ───────────────────────────────────────────

    private static async Task SubmitReadyPlanAsync(Fixture f)
    {
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        Assert.True((await AddObjectiveAsync(f, AlignedNumeric(f.StrategicId, 100m), Employee(f.EmployeeId))).IsSuccess);
        var submit = await SubmitAsync(f, Employee(f.EmployeeId));
        Assert.True(submit.IsSuccess, submit.IsFailure ? submit.Error.Message : null);
    }

    [Fact]
    public async Task Only_the_responsible_manager_can_approve()
    {
        var f = await ArrangeAsync();
        await SubmitReadyPlanAsync(f);
        var planId = await LoadPlanIdAsync(f);

        // A different manager cannot approve.
        await using (var db = f.Store.NewContext())
        {
            var stranger = await new ApprovePlanHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ApprovePlanCommand(f.CycleId, planId, Manager(Guid.NewGuid())), default);
            Assert.True(stranger.IsFailure);
        }

        // The responsible manager approves, locking the plan.
        await using (var db = f.Store.NewContext())
        {
            var approved = await new ApprovePlanHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ApprovePlanCommand(f.CycleId, planId, Manager(f.ManagerId)), default);
            Assert.True(approved.IsSuccess, approved.IsFailure ? approved.Error.Message : null);
            Assert.Equal(PlanLifecycleState.Approved, approved.Value.State);
            Assert.True(approved.Value.IsLocked);
            Assert.Equal(PlanApprovalKind.Normal, approved.Value.ApprovalKind);
        }
    }

    [Fact]
    public async Task Cannot_approve_a_plan_that_is_not_submitted()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        var planId = await LoadPlanIdAsync(f);

        await using var db = f.Store.NewContext();
        var result = await new ApprovePlanHandler(db, f.Workforce, f.Store.Tenant)
            .Handle(new ApprovePlanCommand(f.CycleId, planId, Manager(f.ManagerId)), default);
        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task Return_requires_feedback_and_sends_the_plan_back_to_draft()
    {
        var f = await ArrangeAsync();
        await SubmitReadyPlanAsync(f);
        var planId = await LoadPlanIdAsync(f);

        await using (var db = f.Store.NewContext())
        {
            var empty = await new ReturnPlanHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ReturnPlanCommand(f.CycleId, planId, new ReturnPlanRequest("  "), Manager(f.ManagerId)), default);
            Assert.True(empty.IsFailure);
        }

        await using (var db = f.Store.NewContext())
        {
            var returned = await new ReturnPlanHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ReturnPlanCommand(f.CycleId, planId, new ReturnPlanRequest("Sharpen the second objective."), Manager(f.ManagerId)), default);
            Assert.True(returned.IsSuccess, returned.IsFailure ? returned.Error.Message : null);
            Assert.Equal(PlanLifecycleState.Draft, returned.Value.State);
            Assert.Contains(returned.Value.History, h => h.Kind == PlanDecisionKind.Returned && h.Feedback == "Sharpen the second objective.");
        }
    }

    [Fact]
    public async Task Approved_plan_is_locked_and_the_employee_cannot_edit_it()
    {
        var f = await ArrangeAsync();
        await SubmitReadyPlanAsync(f);
        var planId = await LoadPlanIdAsync(f);
        await using (var db = f.Store.NewContext())
            await new ApprovePlanHandler(db, f.Workforce, f.Store.Tenant).Handle(new ApprovePlanCommand(f.CycleId, planId, Manager(f.ManagerId)), default);

        // Adding another objective after lock is refused (authoring is Draft-only).
        var add = await AddObjectiveAsync(f, Standalone(10m), Employee(f.EmployeeId));
        Assert.True(add.IsFailure);
        Assert.Contains("Forbidden", add.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    // ── Exceptional approval ──────────────────────────────────────────────

    [Fact]
    public async Task Exceptional_approval_requires_a_reason_and_is_attributed_administratively()
    {
        var f = await ArrangeAsync();
        await SubmitReadyPlanAsync(f);
        var planId = await LoadPlanIdAsync(f);
        var adminId = Guid.NewGuid();

        await using (var db = f.Store.NewContext())
        {
            var noReason = await new ExceptionalApprovePlanHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ExceptionalApprovePlanCommand(f.CycleId, planId, new ExceptionalApprovePlanRequest("  "), Admin(adminId)), default);
            Assert.True(noReason.IsFailure);
        }

        await using (var db = f.Store.NewContext())
        {
            var approved = await new ExceptionalApprovePlanHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ExceptionalApprovePlanCommand(f.CycleId, planId, new ExceptionalApprovePlanRequest("Manager on extended leave."), Admin(adminId)), default);
            Assert.True(approved.IsSuccess, approved.IsFailure ? approved.Error.Message : null);
            Assert.Equal(PlanApprovalKind.Exceptional, approved.Value.ApprovalKind);
            // The responsible manager identity is preserved separately; the administrator is the approver.
            Assert.Equal(f.ManagerId, approved.Value.ResponsibleManager!.Id);
            Assert.Contains(approved.Value.History, h => h.Kind == PlanDecisionKind.ApprovedExceptionally && h.Feedback == "Manager on extended leave.");
            // Never both approvals.
            Assert.DoesNotContain(approved.Value.History, h => h.Kind == PlanDecisionKind.Approved);
        }
    }

    [Fact]
    public async Task Exceptional_approval_requires_a_submitted_plan()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        var planId = await LoadPlanIdAsync(f);

        await using var db = f.Store.NewContext();
        var result = await new ExceptionalApprovePlanHandler(db, f.Workforce, f.Store.Tenant)
            .Handle(new ExceptionalApprovePlanCommand(f.CycleId, planId, new ExceptionalApprovePlanRequest("Blocked"), Admin(Guid.NewGuid())), default);
        Assert.True(result.IsFailure);
    }

    // ── Cycle state ───────────────────────────────────────────────────────

    [Fact]
    public async Task Plan_authoring_is_rejected_on_a_closed_cycle()
    {
        var f = await ArrangeAsync();
        await CreatePlanAsync(f, Employee(f.EmployeeId));
        await using (var db = f.Store.NewContext())
        {
            var cycle = await db.Cycles.FirstAsync();
            cycle.Close();
            await db.SaveChangesAsync();
        }

        var add = await AddObjectiveAsync(f, AlignedNumeric(f.StrategicId, 100m), Employee(f.EmployeeId));
        Assert.True(add.IsFailure);
        Assert.Contains("Closed", add.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<Guid> LoadPlanIdAsync(Fixture f)
    {
        await using var db = f.Store.NewContext();
        var plan = await db.EmployeePlans.AsNoTracking().FirstAsync(p => p.CycleId == f.CycleId && p.EmployeeId == f.EmployeeId);
        return plan.Id;
    }
}
