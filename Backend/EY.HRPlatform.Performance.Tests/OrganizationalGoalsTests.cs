using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// Chunk B — organizational objective alignment, publication, and contribution baseline.
/// <para>
/// Authority to establish/publish an organizational objective is <b>organizational-objective
/// management</b>: governed Performance administration (`cycle.manage @Tenant`) or the
/// `objective.org.manage @Tenant` grant. In the direct MVP this is a coarse tenant-wide authority —
/// a holder may manage organizational objectives anywhere in the tenant; fine-grained per-OrgUnit
/// scoping is deferred to the future tenant Access/Profile design. It is deliberately separate from
/// the objective's named accountable person, so reassigning the accountable person never removes the
/// scope manager's ability to publish. Exercises the handlers over the shared in-memory store the way
/// the API does.
/// </para>
/// </summary>
public sealed class OrganizationalGoalsTests
{
    private static readonly DateOnly CycleStart = new(2026, 1, 1);
    private static readonly DateOnly CycleEnd = new(2026, 12, 31);

    private sealed record Fixture(
        TestStore Store,
        FakeCoreWorkforceClient Workforce,
        Guid CycleId,
        Guid StrategicId,
        Guid CooId,
        Guid TalentPodId,
        Guid OtherUnitId,
        Guid NourId);

    private static async Task<Fixture> ArrangeAsync(bool draftCycle = true)
    {
        var store = TestStore.ForNewTenant();
        var workforce = new FakeCoreWorkforceClient();
        var coo = workforce.Add("Coralie Ops");

        // Nour holds the org-manage grant; two distinct org units exist to show the MVP boundary is
        // coarse (she may manage objectives in either).
        var talentPod = Guid.NewGuid();
        var otherUnit = Guid.NewGuid();
        var nour = workforce.Add("Nour Lead", orgUnitId: talentPod, orgUnitName: "Talent Pod");

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

        return new Fixture(store, workforce, cycle.Id, strategic.Id, coo.EmployeeId, talentPod, otherUnit, nour.EmployeeId);
    }

    // Governed Performance administration (`cycle.manage @Tenant`).
    private static GoalActorContext Admin(Guid id) => new(id, IsAdmin: true, HasOrgManageGrant: false);
    // Holds `objective.org.manage @Tenant` — coarse tenant-wide organizational management authority.
    private static GoalActorContext Manager(Guid id) => new(id, IsAdmin: false, HasOrgManageGrant: true);
    // No management authority (ordinary employee / view-only holder).
    private static GoalActorContext Person(Guid id) => new(id, IsAdmin: false, HasOrgManageGrant: false);

    private static CreateOrganizationalObjectiveRequest DirectNumeric(Guid orgUnitId, Guid accountable, Guid parentId, string title = "Improve reliability")
        => new(orgUnitId, "Talent Pod", title, null, accountable, parentId, null, null,
            ObjectiveProgressSource.Direct,
            new MeasurementInput(MeasurementMethod.NumericTarget, 80m, 95m, "%", ImprovementDirection.Increase, null));

    private static CreateOrganizationalObjectiveHandler Create(Fixture f, PerformanceDbContext db)
        => new(db, f.Workforce, f.Store.Tenant);

    private static async Task<Result<GoalDetailDto>> CreateAsync(Fixture f, CreateOrganizationalObjectiveRequest request, GoalActorContext actor)
    {
        await using var db = f.Store.NewContext();
        return await Create(f, db).Handle(new CreateOrganizationalObjectiveCommand(f.CycleId, request, actor), default);
    }

    private static async Task<Result<GoalDetailDto>> PublishAsync(Fixture f, Guid objectiveId, GoalActorContext actor)
    {
        await using var db = f.Store.NewContext();
        return await new PublishObjectiveHandler(db, f.Workforce, f.Store.Tenant)
            .Handle(new PublishObjectiveCommand(f.CycleId, objectiveId, actor), default);
    }

    // ── Creation & alignment invariants ────────────────────────────────────────────────────

    [Fact]
    public async Task Org_objective_creation_requires_a_published_parent()
    {
        var f = await ArrangeAsync();
        var result = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId), Admin(f.CooId));

        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Draft, result.Value.Node.State);
        Assert.Equal(f.StrategicId, result.Value.Parent!.Id);
        Assert.Equal(ObjectiveOwnershipScope.OrgUnit, result.Value.Node.OwnershipScope);
    }

    [Fact]
    public async Task Aligning_to_a_draft_parent_is_rejected()
    {
        var f = await ArrangeAsync();

        Guid draftStrategicId;
        await using (var db = f.Store.NewContext())
        {
            var draft = Objective.CreateStrategic(f.Store.TenantId, f.CycleId, "Draft direction", null, f.CooId,
                CycleStart, CycleEnd, ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd);
            db.Objectives.Add(draft);
            await db.SaveChangesAsync();
            draftStrategicId = draft.Id;
        }

        var result = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, draftStrategicId), Admin(f.CooId));
        Assert.True(result.IsFailure);
        Assert.Contains("published", result.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Child_dates_outside_parent_dates_are_rejected()
    {
        var f = await ArrangeAsync();
        var request = new CreateOrganizationalObjectiveRequest(f.TalentPodId, "Talent Pod", "Too long", null, f.NourId, f.StrategicId,
            CycleStart.AddDays(-5), CycleEnd, ObjectiveProgressSource.Direct,
            new MeasurementInput(MeasurementMethod.ManualPercentage, null, null, null, null, null));
        var result = await CreateAsync(f, request, Admin(f.CooId));

        Assert.True(result.IsFailure);
    }

    // ── Organizational-objective management authority (coarse tenant MVP) ───────────────────

    [Fact]
    public async Task Manager_with_the_org_manage_grant_can_create_an_objective()
    {
        var f = await ArrangeAsync();

        var created = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId), Manager(f.NourId));
        Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Draft, created.Value.Node.State);
    }

    [Fact]
    public async Task Manager_with_the_org_manage_grant_can_publish_an_objective()
    {
        var f = await ArrangeAsync();

        var created = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId), Manager(f.NourId));
        Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Message : null);

        var published = await PublishAsync(f, created.Value.Node.Id, Manager(f.NourId));
        Assert.True(published.IsSuccess, published.IsFailure ? published.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Published, published.Value.Node.State);
        Assert.True(published.Value.Node.IsAlignmentBaseline);
    }

    [Fact]
    public async Task Manager_can_manage_an_objective_in_another_org_unit_too()
    {
        var f = await ArrangeAsync();

        // Coarse MVP: the org-manage grant is tenant-wide, so Nour may establish/publish for a unit
        // she does not belong to. (Fine-grained per-OrgUnit scoping is deferred.)
        var created = await CreateAsync(f, DirectNumeric(f.OtherUnitId, f.NourId, f.StrategicId, "Cross-unit goal"), Manager(f.NourId));
        Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Message : null);

        var published = await PublishAsync(f, created.Value.Node.Id, Manager(f.NourId));
        Assert.True(published.IsSuccess, published.IsFailure ? published.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Published, published.Value.Node.State);
    }

    [Fact]
    public async Task Reassigning_the_accountable_person_does_not_remove_the_managers_authority()
    {
        var f = await ArrangeAsync();
        var other = f.Workforce.Add("Other Person", orgUnitId: f.OtherUnitId);

        // Nour creates with herself accountable (the composer default), then hands accountability off.
        var created = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId), Manager(f.NourId));
        Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Message : null);
        var objectiveId = created.Value.Node.Id;

        await using (var db = f.Store.NewContext())
        {
            var reassign = await new UpdateOrganizationalObjectiveHandler(db, f.Workforce, f.Store.Tenant).Handle(
                new UpdateOrganizationalObjectiveCommand(f.CycleId, objectiveId,
                    new UpdateOrganizationalObjectiveRequest("Improve reliability", null, other.EmployeeId, CycleStart, CycleEnd,
                        ObjectiveProgressSource.Direct, new MeasurementInput(MeasurementMethod.NumericTarget, 80m, 95m, "%", ImprovementDirection.Increase, null)),
                    Manager(f.NourId)), default);
            Assert.True(reassign.IsSuccess, reassign.IsFailure ? reassign.Error.Message : null);
            Assert.Equal(other.EmployeeId, reassign.Value.Accountable.Id);
        }

        // The new accountable person, holding no management authority, cannot publish it.
        var newAccountableAttempt = await PublishAsync(f, objectiveId, Person(other.EmployeeId));
        Assert.True(newAccountableAttempt.IsFailure);
        Assert.Contains("Forbidden", newAccountableAttempt.Error.Code, StringComparison.OrdinalIgnoreCase);

        // Nour, still the authorized manager, can still edit and publish it.
        var published = await PublishAsync(f, objectiveId, Manager(f.NourId));
        Assert.True(published.IsSuccess, published.IsFailure ? published.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Published, published.Value.Node.State);
    }

    [Fact]
    public async Task Employee_without_the_manage_grant_cannot_create()
    {
        var f = await ArrangeAsync();
        var employee = f.Workforce.Add("Talent Employee", orgUnitId: f.TalentPodId);

        var result = await CreateAsync(f, DirectNumeric(f.TalentPodId, employee.EmployeeId, f.StrategicId), Person(employee.EmployeeId));
        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task View_only_holder_cannot_publish()
    {
        var f = await ArrangeAsync();
        var viewer = f.Workforce.Add("Viewer", orgUnitId: f.TalentPodId);

        var created = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId), Admin(f.CooId));
        Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Message : null);

        var result = await PublishAsync(f, created.Value.Node.Id, Person(viewer.EmployeeId));
        Assert.True(result.IsFailure);
        Assert.Contains("Forbidden", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Governed_admin_remains_authorized_to_create_and_publish()
    {
        var f = await ArrangeAsync();
        var adminId = Guid.NewGuid();

        var created = await CreateAsync(f, DirectNumeric(f.OtherUnitId, f.NourId, f.StrategicId, "Admin-established"), Admin(adminId));
        Assert.True(created.IsSuccess, created.IsFailure ? created.Error.Message : null);

        var published = await PublishAsync(f, created.Value.Node.Id, Admin(adminId));
        Assert.True(published.IsSuccess, published.IsFailure ? published.Error.Message : null);
        Assert.Equal(ObjectiveLifecycleState.Published, published.Value.Node.State);
    }

    // ── Baseline & contribution (admin-driven; authority covered above) ─────────────────────

    [Fact]
    public async Task Published_parent_becomes_a_valid_baseline_for_downstream_objectives()
    {
        var f = await ArrangeAsync();

        var ops = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId, "Ops"), Admin(f.CooId));
        Assert.True(ops.IsSuccess, ops.IsFailure ? ops.Error.Message : null);
        var opsId = ops.Value.Node.Id;
        Assert.True((await PublishAsync(f, opsId, Admin(f.CooId))).IsSuccess);

        var child = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, opsId, "Cut response time"), Admin(f.CooId));
        Assert.True(child.IsSuccess, child.IsFailure ? child.Error.Message : null);
        Assert.Equal(opsId, child.Value.Parent!.Id);
    }

    [Fact]
    public async Task A_draft_child_cannot_be_a_downstream_alignment_baseline()
    {
        var f = await ArrangeAsync();

        var ops = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId, "Ops"), Admin(f.CooId));
        Assert.True(ops.IsSuccess, ops.IsFailure ? ops.Error.Message : null);

        // Ops is never published, so it is not yet an alignment baseline.
        var child = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, ops.Value.Node.Id, "Cut response time"), Admin(f.CooId));
        Assert.True(child.IsFailure);
        Assert.Contains("published", child.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Calculated_baseline_locks_only_at_100_percent_over_published_children()
    {
        var f = await ArrangeAsync();
        var admin = Admin(f.CooId);

        var opsId = await CreateCalculatedAsync(f, f.NourId, f.StrategicId, admin);
        Assert.True((await PublishAsync(f, opsId, admin)).IsSuccess);

        var childA = (await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, opsId, "Child A"), admin)).Value.Node.Id;
        var childB = (await CreateAsync(f, DirectNumeric(f.OtherUnitId, f.NourId, opsId, "Child B"), admin)).Value.Node.Id;
        Assert.True((await PublishAsync(f, childA, admin)).IsSuccess);
        Assert.True((await PublishAsync(f, childB, admin)).IsSuccess);

        // 60/30 = 90% cannot lock.
        await using (var db = f.Store.NewContext())
        {
            var configured = await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
                new ConfigureContributionCommand(f.CycleId, opsId,
                    new ConfigureContributionRequest([new ContributionInput(childA, 60m), new ContributionInput(childB, 30m)]), admin), default);
            Assert.True(configured.IsSuccess, configured.IsFailure ? configured.Error.Message : null);
            Assert.Equal(90m, configured.Value.Node.ContributionWeightTotal);
        }
        await using (var db = f.Store.NewContext())
        {
            var lockedTooEarly = await new LockContributionHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new LockContributionCommand(f.CycleId, opsId, admin), default);
            Assert.True(lockedTooEarly.IsFailure);
        }

        // Correct to 60/40 = 100% and lock.
        await using (var db = f.Store.NewContext())
            await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
                new ConfigureContributionCommand(f.CycleId, opsId,
                    new ConfigureContributionRequest([new ContributionInput(childA, 60m), new ContributionInput(childB, 40m)]), admin), default);
        await using (var db = f.Store.NewContext())
        {
            var locked = await new LockContributionHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new LockContributionCommand(f.CycleId, opsId, admin), default);
            Assert.True(locked.IsSuccess, locked.IsFailure ? locked.Error.Message : null);
            Assert.True(locked.Value.Node.IsContributionBaselineLocked);
        }
    }

    [Fact]
    public async Task Calculated_baseline_cannot_lock_while_a_contributor_is_still_draft()
    {
        var f = await ArrangeAsync();
        var admin = Admin(f.CooId);

        var opsId = await CreateCalculatedAsync(f, f.NourId, f.StrategicId, admin);
        Assert.True((await PublishAsync(f, opsId, admin)).IsSuccess);

        var childA = (await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, opsId, "Child A"), admin)).Value.Node.Id;
        var childB = (await CreateAsync(f, DirectNumeric(f.OtherUnitId, f.NourId, opsId, "Child B"), admin)).Value.Node.Id;
        Assert.True((await PublishAsync(f, childA, admin)).IsSuccess); // childB stays Draft

        await using (var db = f.Store.NewContext())
            await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
                new ConfigureContributionCommand(f.CycleId, opsId,
                    new ConfigureContributionRequest([new ContributionInput(childA, 60m), new ContributionInput(childB, 40m)]), admin), default);
        await using (var db = f.Store.NewContext())
        {
            var locked = await new LockContributionHandler(db, f.Workforce, f.Store.Tenant)
                .Handle(new LockContributionCommand(f.CycleId, opsId, admin), default);
            Assert.True(locked.IsFailure);
            Assert.Contains("published", locked.Error.Message, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Only_aligned_children_may_be_configured_as_contributors()
    {
        var f = await ArrangeAsync();
        var admin = Admin(f.CooId);
        var opsId = await CreateCalculatedAsync(f, f.NourId, f.StrategicId, admin);

        await using var db = f.Store.NewContext();
        var result = await new ConfigureContributionHandler(db, f.Workforce, f.Store.Tenant).Handle(
            new ConfigureContributionCommand(f.CycleId, opsId,
                new ConfigureContributionRequest([new ContributionInput(Guid.NewGuid(), 100m)]), admin), default);

        Assert.True(result.IsFailure);
        Assert.Contains("aligned children", result.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Direct_and_calculated_are_mutually_exclusive()
    {
        var f = await ArrangeAsync();
        Assert.Throws<ArgumentException>(() =>
            Objective.CreateOrganizational(f.Store.TenantId, f.CycleId, Guid.NewGuid(), "Ops", "X", null, Guid.NewGuid(), f.StrategicId,
                CycleStart, CycleEnd, ObjectiveProgressSource.Calculated,
                ObjectiveMeasurement.ManualPercentage(), CycleStart, CycleEnd, CycleStart, CycleEnd));
    }

    [Fact]
    public async Task Organizational_planning_is_rejected_on_a_closed_cycle()
    {
        var f = await ArrangeAsync(draftCycle: false);
        await using (var db = f.Store.NewContext())
        {
            var cycle = await db.Cycles.FirstAsync();
            cycle.Close();
            await db.SaveChangesAsync();
        }

        var result = await CreateAsync(f, DirectNumeric(f.TalentPodId, f.NourId, f.StrategicId), Admin(f.CooId));
        Assert.True(result.IsFailure);
        Assert.Contains("Closed", result.Error.Code, StringComparison.OrdinalIgnoreCase);
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
        var request = new CreateOrganizationalObjectiveRequest(f.TalentPodId, "Talent Pod", "Operational excellence", null,
            accountable, parentId, null, null, ObjectiveProgressSource.Calculated, null);
        var result = await CreateAsync(f, request, actor);
        Assert.True(result.IsSuccess, result.IsFailure ? result.Error.Message : null);
        return result.Value.Node.Id;
    }
}
