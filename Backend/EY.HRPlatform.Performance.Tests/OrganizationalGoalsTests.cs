using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Chunk B — organizational objective alignment, approval, and contribution baseline. Exercises the
/// handlers over the shared in-memory store the way the API does (a fresh context per request).
/// </summary>
public sealed class OrganizationalGoalsTests
{
    private static readonly DateOnly CycleStart = new(2026, 1, 1);
    private static readonly DateOnly CycleEnd = new(2026, 12, 31);

    private sealed record Fixture(TestStore Store, FakeCoreWorkforceClient Workforce, Guid CycleId, Guid StrategicId, Guid CooId);

    private static async Task<Fixture> ArrangeAsync(bool draftCycle = true)
    {
        var store = TestStore.ForNewTenant();
        var workforce = new FakeCoreWorkforceClient();
        var coo = workforce.Add("Coralie Ops");

        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY2026", CycleStart, CycleEnd, CycleStart.AddDays(30));
        var strategic = Objective.CreateStrategic(store.TenantId, cycle.Id, "Grow the company", null, coo.EmployeeId,
            CycleStart, CycleEnd, ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd);
        strategic.Publish();

        await using (var db = store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Objectives.Add(strategic);
            await db.SaveChangesAsync();
            if (!draftCycle)
            {
                var tracked = await db.Cycles.FirstAsync();
                var snapshot = ActivationSnapshot.Capture(store.TenantId, cycle.Id, "FY2026", CycleStart, CycleEnd, CycleStart.AddDays(30), CycleStart, 1, "{}", "{}", "[]", "[]");
                tracked.Activate(snapshot);
                db.Entry(snapshot).State = EntityState.Added;
                await db.SaveChangesAsync();
            }
        }

        return new Fixture(store, workforce, cycle.Id, strategic.Id, coo.EmployeeId);
    }

    private static GoalActorContext Admin(Guid id) => new(id, IsAdmin: true, CanPublishStrategy: true);
    private static GoalActorContext Person(Guid id) => new(id, IsAdmin: false, CanPublishStrategy: false);

    private static CreateOrganizationalObjectiveRequest DirectNumeric(Guid orgUnitId, Guid accountable, Guid parentId, string title = "Improve reliability")
        => new(orgUnitId, "Operations", title, null, accountable, parentId, null, null,
            ObjectiveProgressSource.Direct,
            new MeasurementInput(MeasurementMethod.NumericTarget, 80m, 95m, "%", ImprovementDirection.Increase, null));

    private static CreateOrganizationalObjectiveHandler Create(Fixture f, PerformanceDbContext db)
        => new(db, f.Workforce, f.Store.Tenant);

    // ── Creation & alignment ──────────────────────────────────────────────

    [Fact]
    public async Task Org_objective_creation_requires_a_published_or_approved_parent()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");

        await using var db = f.Store.NewContext();
        var result = await Create(f, db).Handle(
            new CreateOrganizationalObjectiveCommand(f.CycleId, DirectNumeric(Guid.NewGuid(), director.EmployeeId, f.StrategicId), Admin(f.CooId)), default);

        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Draft, result.Value.Node.State);
        Assert.Equal(f.StrategicId, result.Value.Parent!.Id);
        Assert.Equal(ObjectiveOwnershipScope.OrgUnit, result.Value.Node.OwnershipScope);
    }

    [Fact]
    public async Task Aligning_to_a_draft_parent_is_rejected()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");

        // A second, still-Draft strategic objective is not an alignment baseline.
        Guid draftStrategicId;
        await using (var db = f.Store.NewContext())
        {
            var draft = Objective.CreateStrategic(f.Store.TenantId, f.CycleId, "Draft direction", null, f.CooId,
                CycleStart, CycleEnd, ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd);
            db.Objectives.Add(draft);
            await db.SaveChangesAsync();
            draftStrategicId = draft.Id;
        }

        await using (var db = f.Store.NewContext())
        {
            var result = await Create(f, db).Handle(
                new CreateOrganizationalObjectiveCommand(f.CycleId, DirectNumeric(Guid.NewGuid(), director.EmployeeId, draftStrategicId), Admin(f.CooId)), default);
            Assert.True(result.IsFailure);
            Assert.Contains("published or approved", result.Error.Message, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Child_dates_outside_parent_dates_are_rejected()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");

        await using var db = f.Store.NewContext();
        var request = new CreateOrganizationalObjectiveRequest(Guid.NewGuid(), "Ops", "Too long", null, director.EmployeeId, f.StrategicId,
            CycleStart.AddDays(-5), CycleEnd, ObjectiveProgressSource.Direct,
            new MeasurementInput(MeasurementMethod.ManualPercentage, null, null, null, null, null));
        var result = await Create(f, db).Handle(new CreateOrganizationalObjectiveCommand(f.CycleId, request, Admin(f.CooId)), default);

        Assert.True(result.IsFailure);
    }

    [Fact]
    public async Task Unauthorized_user_cannot_create_under_a_parent()
    {
        var f = await ArrangeAsync();
        var stranger = f.Workforce.Add("Sam Stranger");

        await using var db = f.Store.NewContext();
        var result = await Create(f, db).Handle(
            new CreateOrganizationalObjectiveCommand(f.CycleId, DirectNumeric(Guid.NewGuid(), stranger.EmployeeId, f.StrategicId), Person(stranger.EmployeeId)), default);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    // ── Lifecycle & approval authorization ────────────────────────────────

    private static async Task<Guid> CreateOrgAsync(Fixture f, Guid accountable, Guid parentId, GoalActorContext actor)
    {
        await using var db = f.Store.NewContext();
        var result = await Create(f, db).Handle(
            new CreateOrganizationalObjectiveCommand(f.CycleId, DirectNumeric(Guid.NewGuid(), accountable, parentId), actor), default);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        return result.Value.Node.Id;
    }

    private static async Task SubmitAsync(Fixture f, Guid objectiveId, GoalActorContext actor)
    {
        await using var db = f.Store.NewContext();
        var result = await new SubmitObjectiveHandler(db, f.Workforce, f.Store.Tenant)
            .Handle(new SubmitObjectiveCommand(f.CycleId, objectiveId, actor), default);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
    }

    [Fact]
    public async Task Only_the_parent_accountable_person_can_approve()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");
        var objectiveId = await CreateOrgAsync(f, director.EmployeeId, f.StrategicId, Admin(f.CooId));
        await SubmitAsync(f, objectiveId, Person(director.EmployeeId));

        // The objective owner (director) is NOT the parent-accountable and cannot approve their own.
        await using (var db = f.Store.NewContext())
        {
            var self = await new ApproveObjectiveHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ApproveObjectiveCommand(f.CycleId, objectiveId, Person(director.EmployeeId)), default);
            Assert.True(self.IsFailure);
        }

        // The strategic parent's accountable (COO) approves.
        await using (var db = f.Store.NewContext())
        {
            var approved = await new ApproveObjectiveHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ApproveObjectiveCommand(f.CycleId, objectiveId, Person(f.CooId)), default);
            Assert.True(approved.IsSuccess, approved.IsFailure ? approved.Error.Message : null);
            Assert.Equal(ObjectiveLifecycleState.Approved, approved.Value.Node.State);
            Assert.True(approved.Value.Node.IsAlignmentBaseline);
        }
    }

    [Fact]
    public async Task Tenant_admin_cannot_approve_an_organizational_objective()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");
        var objectiveId = await CreateOrgAsync(f, director.EmployeeId, f.StrategicId, Admin(f.CooId));
        await SubmitAsync(f, objectiveId, Person(director.EmployeeId));

        // A tenant performance administrator who is not the parent-accountable person cannot approve.
        var adminId = Guid.NewGuid();
        await using var db = f.Store.NewContext();
        var result = await new ApproveObjectiveHandler(db, f.Workforce, f.Store.Tenant)
            .Handle(new ApproveObjectiveCommand(f.CycleId, objectiveId, Admin(adminId)), default);

        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Return_requires_feedback_and_sends_the_objective_back_to_draft()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");
        var objectiveId = await CreateOrgAsync(f, director.EmployeeId, f.StrategicId, Admin(f.CooId));
        await SubmitAsync(f, objectiveId, Person(director.EmployeeId));

        await using (var db = f.Store.NewContext())
        {
            var empty = await new ReturnObjectiveHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ReturnObjectiveCommand(f.CycleId, objectiveId, new ReturnObjectiveRequest("  "), Person(f.CooId)), default);
            Assert.True(empty.IsFailure);
        }

        await using (var db = f.Store.NewContext())
        {
            var returned = await new ReturnObjectiveHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new ReturnObjectiveCommand(f.CycleId, objectiveId, new ReturnObjectiveRequest("Tighten the target."), Person(f.CooId)), default);
            Assert.True(returned.IsSuccess, returned.IsFailure ? returned.Error.Message : null);
            Assert.Equal(ObjectiveLifecycleState.Draft, returned.Value.Node.State);
            Assert.Contains(returned.Value.History, h => h.Kind == ObjectiveDecisionKind.Returned && h.Feedback == "Tighten the target.");
        }
    }

    [Fact]
    public async Task Approved_parent_becomes_a_valid_baseline_for_downstream_objectives()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");
        var manager = f.Workforce.Add("Mo Manager");

        var opsId = await CreateOrgAsync(f, director.EmployeeId, f.StrategicId, Admin(f.CooId));
        await SubmitAsync(f, opsId, Person(director.EmployeeId));
        await using (var db = f.Store.NewContext())
            await new ApproveObjectiveHandler(db, f.Workforce, f.Store.Tenant).Handle(new ApproveObjectiveCommand(f.CycleId, opsId, Person(f.CooId)), default);

        // The director (accountable of the approved Ops objective) may now cascade a child under it.
        await using (var db = f.Store.NewContext())
        {
            var child = await Create(f, db).Handle(
                new CreateOrganizationalObjectiveCommand(f.CycleId, DirectNumeric(Guid.NewGuid(), manager.EmployeeId, opsId, "Cut response time"), Person(director.EmployeeId)), default);
            Assert.True(child.IsSuccess, child.IsFailure ? child.Error.Message : null);
            Assert.Equal(opsId, child.Value.Parent!.Id);
        }
    }

    // ── Progress source & contribution baseline ───────────────────────────

    [Fact]
    public async Task Calculated_baseline_locks_only_at_100_percent_over_configured_children()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");
        var m1 = f.Workforce.Add("Manager One");
        var m2 = f.Workforce.Add("Manager Two");

        // A calculated Ops objective, approved, with two aligned+approved children.
        var opsId = await CreateCalculatedAsync(f, director.EmployeeId, f.StrategicId, Admin(f.CooId));
        await SubmitAsync(f, opsId, Person(director.EmployeeId));
        await using (var db = f.Store.NewContext())
            await new ApproveObjectiveHandler(db, f.Workforce, f.Store.Tenant).Handle(new ApproveObjectiveCommand(f.CycleId, opsId, Person(f.CooId)), default);

        var childA = await CreateOrgAsync(f, m1.EmployeeId, opsId, Person(director.EmployeeId));
        var childB = await CreateOrgAsync(f, m2.EmployeeId, opsId, Person(director.EmployeeId));
        foreach (var (id, accountable) in new[] { (childA, m1.EmployeeId), (childB, m2.EmployeeId) })
        {
            await SubmitAsync(f, id, Person(accountable));
            await using var db = f.Store.NewContext();
            await new ApproveObjectiveHandler(db, f.Workforce, f.Store.Tenant).Handle(new ApproveObjectiveCommand(f.CycleId, id, Person(director.EmployeeId)), default);
        }

        // 60/30 = 90% cannot lock.
        await using (var db = f.Store.NewContext())
        {
            var configured = await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
                new ConfigureContributionCommand(f.CycleId, opsId,
                    new ConfigureContributionRequest([new ContributionInput(childA, 60m), new ContributionInput(childB, 30m)]), Person(director.EmployeeId)), default);
            Assert.True(configured.IsSuccess, configured.IsFailure ? configured.Error.Message : null);
            Assert.Equal(90m, configured.Value.Node.ContributionWeightTotal);
        }
        await using (var db = f.Store.NewContext())
        {
            var lockedTooEarly = await new LockContributionHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new LockContributionCommand(f.CycleId, opsId, Person(director.EmployeeId)), default);
            Assert.True(lockedTooEarly.IsFailure);
        }

        // Correct to 60/40 = 100% and lock.
        await using (var db = f.Store.NewContext())
            await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
                new ConfigureContributionCommand(f.CycleId, opsId,
                    new ConfigureContributionRequest([new ContributionInput(childA, 60m), new ContributionInput(childB, 40m)]), Person(director.EmployeeId)), default);
        await using (var db = f.Store.NewContext())
        {
            var locked = await new LockContributionHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new LockContributionCommand(f.CycleId, opsId, Person(director.EmployeeId)), default);
            Assert.True(locked.IsSuccess, locked.IsFailure ? locked.Error.Message : null);
            Assert.True(locked.Value.Node.IsContributionBaselineLocked);
        }
    }

    [Fact]
    public async Task Only_aligned_children_may_be_configured_as_contributors()
    {
        var f = await ArrangeAsync();
        var director = f.Workforce.Add("Dana Director");
        var opsId = await CreateCalculatedAsync(f, director.EmployeeId, f.StrategicId, Admin(f.CooId));

        await using var db = f.Store.NewContext();
        var result = await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
            new ConfigureContributionCommand(f.CycleId, opsId,
                new ConfigureContributionRequest([new ContributionInput(Guid.NewGuid(), 100m)]), Person(director.EmployeeId)), default);

        Assert.True(result.IsFailure);
        Assert.Contains("aligned children", result.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Direct_and_calculated_are_mutually_exclusive()
    {
        var f = await ArrangeAsync();
        // A calculated objective must not carry a direct measurement.
        Assert.Throws<ArgumentException>(() =>
            Objective.CreateOrganizational(f.Store.TenantId, f.CycleId, Guid.NewGuid(), "Ops", "X", null, Guid.NewGuid(), f.StrategicId,
                CycleStart, CycleEnd, ObjectiveProgressSource.Calculated,
                ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd, CycleStart, CycleEnd));
    }

    [Fact]
    public async Task Organizational_planning_is_rejected_on_a_closed_cycle()
    {
        var f = await ArrangeAsync(draftCycle: false);
        var director = f.Workforce.Add("Dana Director");
        await using (var db = f.Store.NewContext())
        {
            var cycle = await db.Cycles.FirstAsync();
            cycle.Close();
            await db.SaveChangesAsync();
        }

        await using (var db = f.Store.NewContext())
        {
            var result = await Create(f, db).Handle(
                new CreateOrganizationalObjectiveCommand(f.CycleId, DirectNumeric(Guid.NewGuid(), director.EmployeeId, f.StrategicId), Admin(f.CooId)), default);
            Assert.True(result.IsFailure);
            Assert.Contains("Closed", result.Error.Code, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public void Reassigning_accountability_preserves_ownership_scope()
    {
        var tenant = Guid.NewGuid();
        var objective = Objective.CreateOrganizational(tenant, Guid.NewGuid(), Guid.NewGuid(), "Ops", "Reliability", null,
            Guid.NewGuid(), Guid.NewGuid(), CycleStart, CycleEnd, ObjectiveProgressSource.Direct,
            ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd, CycleStart, CycleEnd);

        objective.ReassignAccountablePerson(Guid.NewGuid());
        Assert.Equal(ObjectiveOwnershipScope.OrgUnit, objective.OwnershipScope);
    }

    private static async Task<Guid> CreateCalculatedAsync(Fixture f, Guid accountable, Guid parentId, GoalActorContext actor)
    {
        await using var db = f.Store.NewContext();
        var request = new CreateOrganizationalObjectiveRequest(Guid.NewGuid(), "Operations", "Operational excellence", null,
            accountable, parentId, null, null, ObjectiveProgressSource.Calculated, null);
        var result = await Create(f, db).Handle(new CreateOrganizationalObjectiveCommand(f.CycleId, request, actor), default);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        return result.Value.Node.Id;
    }
}
