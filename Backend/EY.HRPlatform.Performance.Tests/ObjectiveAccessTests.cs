using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Plans;
using EY.HRPlatform.Performance.Features.Goals;
using EY.HRPlatform.Performance.Features.StrategicDirection;
using EY.HRPlatform.Performance.Infrastructure.Core;
using EY.HRPlatform.Performance.Tests.TestHelpers;

namespace EY.HRPlatform.Performance.Tests;

/// <summary>
/// One objective visibility policy across every scope and every surface that returns an objective:
/// published direction is readable by every entrant; a Draft stays with the people who can shape it;
/// an Employee objective follows plan visibility (owner, administration, and the responsible manager
/// once the plan is put forward). Detail, overview, strategy and traversal must all agree.
/// </summary>
public sealed class ObjectiveAccessTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    private sealed record Fixture(
        TestStore Store,
        FakeCoreWorkforceClient Workforce,
        Guid CycleId,
        Guid PublishedStrategyId,
        Guid DraftStrategyId,
        Guid TalentPodObjectiveId,
        Guid DeliveryDraftId,
        Guid PlanId,
        Guid EmployeeObjectiveId,
        Guid CooId,
        Guid NourId,
        Guid SamiId,
        Guid DeliveryOwnerId);

    private static async Task<Fixture> ArrangeAsync(bool submitPlan = false)
    {
        var store = TestStore.ForNewTenant();
        var tenant = store.TenantId;
        var workforce = new FakeCoreWorkforceClient();
        var talentPod = Guid.NewGuid();
        var delivery = Guid.NewGuid();
        var coo = workforce.Add("Coralie Ops");
        var nour = workforce.Add("Nour Lead", orgUnitId: talentPod, orgUnitName: "Talent Pod");
        var sami = workforce.Add("Sami Member", orgUnitId: talentPod, orgUnitName: "Talent Pod");
        var deliveryOwner = workforce.Add("Delivery Owner", orgUnitId: delivery, orgUnitName: "Delivery Pod");
        workforce.OrgUnits[talentPod] = new WorkforceOrgUnitContext(talentPod, "Talent Pod", null, true, []);
        workforce.OrgUnits[delivery] = new WorkforceOrgUnitContext(delivery, "Delivery Pod", null, true, []);

        var cycle = PerformanceCycle.CreateDraft(tenant, "FY2026", Start, End, Start.AddDays(30));
        var strategy = Objective.CreateStrategic(tenant, cycle.Id, "Grow the company", null, coo.EmployeeId,
            Start, End, ObjectiveMeasurement.ManualPercentage(), Start, End);
        strategy.Publish();
        var draftStrategy = Objective.CreateStrategic(tenant, cycle.Id, "Unannounced bet", null, coo.EmployeeId,
            Start, End, ObjectiveMeasurement.ManualPercentage(), Start, End);

        var talentObjective = Objective.CreateOrganizational(tenant, cycle.Id, talentPod, "Talent Pod",
            "Grow talent", null, nour.EmployeeId, strategy.Id, Start, End, ObjectiveProgressSource.Direct,
            ObjectiveMeasurement.ManualPercentage(), Start, End, Start, End);
        talentObjective.Publish();
        var deliveryDraft = Objective.CreateOrganizational(tenant, cycle.Id, delivery, "Delivery Pod",
            "Ship faster", null, deliveryOwner.EmployeeId, strategy.Id, Start, End, ObjectiveProgressSource.Direct,
            ObjectiveMeasurement.ManualPercentage(), Start, End, Start, End);

        var plan = EmployeePlan.Create(tenant, cycle.Id, Guid.NewGuid(), sami.EmployeeId, "Sami Member",
            "Talent Pod", nour.EmployeeId, "Nour Lead");
        var employeeObjective = Objective.CreateEmployee(tenant, cycle.Id, plan.Id, sami.EmployeeId,
            "Run two workshops", null, talentObjective.Id, Start, End, ObjectiveMeasurement.ManualPercentage(),
            100m, Start, End, Start, End);
        if (submitPlan)
            plan.Submit(sami.EmployeeId, new PlanSubmissionFacts(1, true, 100m, true, false, true));

        await using (var db = store.NewContext())
        {
            db.Cycles.Add(cycle);
            db.Objectives.AddRange(strategy, draftStrategy, talentObjective, deliveryDraft, employeeObjective);
            db.EmployeePlans.Add(plan);
            await db.SaveChangesAsync();
        }

        return new Fixture(store, workforce, cycle.Id, strategy.Id, draftStrategy.Id, talentObjective.Id,
            deliveryDraft.Id, plan.Id, employeeObjective.Id, coo.EmployeeId, nour.EmployeeId, sami.EmployeeId,
            deliveryOwner.EmployeeId);
    }

    private static GoalActorContext Admin(Guid id) => new(id, IsAdmin: true, HasOrgManageGrant: false);
    private static GoalActorContext Manager(Guid id) => new(id, IsAdmin: false, HasOrgManageGrant: true, CanReviewReports: true);
    private static GoalActorContext Employee(Guid id) => new(id, IsAdmin: false, HasOrgManageGrant: false);
    private static GoalActorContext StrategyOwner(Guid id) => new(id, IsAdmin: false, HasOrgManageGrant: false, CanPublishStrategy: true);

    private static async Task<bool> CanOpenAsync(Fixture f, Guid objectiveId, GoalActorContext actor)
    {
        await using var db = f.Store.NewContext();
        var result = await new GetGoalDetailHandler(db, f.Workforce)
            .Handle(new GetGoalDetailQuery(f.CycleId, objectiveId, actor), default);
        Assert.True(result.IsSuccess || result.Error.Code == "Objective.ViewForbidden",
            result.IsFailure ? result.Error.Code : null);
        return result.IsSuccess;
    }

    [Fact]
    public async Task Employee_objective_is_readable_only_by_owner_admin_and_a_manager_it_was_put_forward_to()
    {
        var f = await ArrangeAsync();

        Assert.True(await CanOpenAsync(f, f.EmployeeObjectiveId, Employee(f.SamiId)));
        Assert.True(await CanOpenAsync(f, f.EmployeeObjectiveId, Admin(f.CooId)));
        Assert.False(await CanOpenAsync(f, f.EmployeeObjectiveId, Employee(f.DeliveryOwnerId)));
        // A never-submitted Draft plan is the employee's private workspace — not yet the manager's.
        Assert.False(await CanOpenAsync(f, f.EmployeeObjectiveId, Manager(f.NourId)));

        var submitted = await ArrangeAsync(submitPlan: true);
        Assert.True(await CanOpenAsync(submitted, submitted.EmployeeObjectiveId, Manager(submitted.NourId)));
        Assert.False(await CanOpenAsync(submitted, submitted.EmployeeObjectiveId, Manager(submitted.DeliveryOwnerId)));
    }

    [Fact]
    public async Task Published_direction_is_readable_by_every_entrant_and_drafts_stay_with_their_shapers()
    {
        var f = await ArrangeAsync();

        Assert.True(await CanOpenAsync(f, f.PublishedStrategyId, Employee(f.SamiId)));
        Assert.True(await CanOpenAsync(f, f.TalentPodObjectiveId, Employee(f.DeliveryOwnerId)));

        Assert.False(await CanOpenAsync(f, f.DraftStrategyId, Employee(f.SamiId)));
        Assert.True(await CanOpenAsync(f, f.DraftStrategyId, StrategyOwner(f.CooId)));
        Assert.True(await CanOpenAsync(f, f.DraftStrategyId, Admin(f.CooId)));

        Assert.False(await CanOpenAsync(f, f.DeliveryDraftId, Employee(f.SamiId)));
        Assert.False(await CanOpenAsync(f, f.DeliveryDraftId, Manager(f.NourId)));
        Assert.True(await CanOpenAsync(f, f.DeliveryDraftId, Employee(f.DeliveryOwnerId)));
        Assert.True(await CanOpenAsync(f, f.DeliveryDraftId, Admin(f.CooId)));
    }

    [Fact]
    public async Task Overview_never_carries_another_teams_draft()
    {
        var f = await ArrangeAsync();

        async Task<IReadOnlyCollection<Guid>> VisibleTo(GoalActorContext actor)
        {
            await using var db = f.Store.NewContext();
            var result = await new GetGoalsOverviewHandler(db, f.Workforce)
                .Handle(new GetGoalsOverviewQuery(f.CycleId, actor), default);
            Assert.True(result.IsSuccess);
            Assert.Equal(
                result.Value.Nodes.Count(n => n.OwnershipScope == ObjectiveOwnershipScope.OrgUnit && n.State == ObjectiveLifecycleState.Draft),
                result.Value.DraftCount);
            return result.Value.Nodes.Select(node => node.Id).ToList();
        }

        var employee = await VisibleTo(Employee(f.SamiId));
        Assert.Contains(f.TalentPodObjectiveId, employee);
        Assert.DoesNotContain(f.DeliveryDraftId, employee);
        Assert.DoesNotContain(f.DraftStrategyId, employee);
        Assert.DoesNotContain(f.DeliveryDraftId, await VisibleTo(Manager(f.NourId)));
        Assert.Contains(f.DeliveryDraftId, await VisibleTo(Employee(f.DeliveryOwnerId)));
        Assert.Contains(f.DeliveryDraftId, await VisibleTo(Admin(f.CooId)));
    }

    [Fact]
    public async Task Strategy_list_shows_drafts_only_to_strategy_owners_and_administrators()
    {
        var f = await ArrangeAsync();

        async Task<IReadOnlyCollection<Guid>> ListFor(GoalActorContext actor)
        {
            await using var db = f.Store.NewContext();
            var result = await new ListStrategyHandler(db, f.Workforce)
                .Handle(new ListStrategyQuery(f.CycleId, actor), default);
            Assert.True(result.IsSuccess);
            return result.Value.Select(item => item.Id).ToList();
        }

        var employee = await ListFor(Employee(f.SamiId));
        Assert.Contains(f.PublishedStrategyId, employee);
        Assert.DoesNotContain(f.DraftStrategyId, employee);
        Assert.Contains(f.DraftStrategyId, await ListFor(StrategyOwner(f.CooId)));
        Assert.Contains(f.DraftStrategyId, await ListFor(Admin(f.CooId)));
    }

    [Fact]
    public async Task Detail_traversal_is_filtered_by_the_same_rule()
    {
        var f = await ArrangeAsync();

        async Task<IReadOnlyCollection<Guid>> ChildrenFor(GoalActorContext actor)
        {
            await using var db = f.Store.NewContext();
            var result = await new GetGoalDetailHandler(db, f.Workforce)
                .Handle(new GetGoalDetailQuery(f.CycleId, f.PublishedStrategyId, actor), default);
            Assert.True(result.IsSuccess);
            return result.Value.Children.Select(child => child.Id).ToList();
        }

        var employee = await ChildrenFor(Employee(f.SamiId));
        Assert.Contains(f.TalentPodObjectiveId, employee);
        Assert.DoesNotContain(f.DeliveryDraftId, employee);
        Assert.Contains(f.DeliveryDraftId, await ChildrenFor(Admin(f.CooId)));
    }

    [Fact]
    public async Task Detail_carries_the_cycle_the_plan_facet_and_capabilities_from_one_policy()
    {
        var f = await ArrangeAsync();
        await using var db = f.Store.NewContext();
        var handler = new GetGoalDetailHandler(db, f.Workforce);

        var own = await handler.Handle(new GetGoalDetailQuery(f.CycleId, f.EmployeeObjectiveId, Employee(f.SamiId)), default);
        Assert.True(own.IsSuccess);
        Assert.Equal(f.CycleId, own.Value.CycleId);
        Assert.NotNull(own.Value.Plan);
        Assert.Equal(f.PlanId, own.Value.Plan!.PlanId);
        Assert.Equal(100m, own.Value.Plan.PlanWeight);
        Assert.True(own.Value.CanReadProgressHistory);
        // Progress opens with plan approval, never on a Draft plan.
        Assert.False(own.Value.CanUpdateProgress);
        Assert.False(own.Value.CanEdit);

        // An aligned reader sees the published parent, not who recorded what on it.
        var aligned = await handler.Handle(new GetGoalDetailQuery(f.CycleId, f.TalentPodObjectiveId, Employee(f.SamiId)), default);
        Assert.True(aligned.IsSuccess);
        Assert.Null(aligned.Value.Plan);
        Assert.False(aligned.Value.CanReadProgressHistory);
        Assert.False(aligned.Value.CanUpdateProgress);

        // Its accountable owner and governor records progress on the published team objective.
        var owner = await handler.Handle(new GetGoalDetailQuery(f.CycleId, f.TalentPodObjectiveId, Manager(f.NourId)), default);
        Assert.True(owner.Value.CanUpdateProgress);
        Assert.True(owner.Value.CanReadProgressHistory);

        // A Draft team objective without aligned children can be removed by its governor.
        var draft = await handler.Handle(new GetGoalDetailQuery(f.CycleId, f.DeliveryDraftId, Admin(f.CooId)), default);
        Assert.True(draft.Value.CanDelete);
        Assert.True(draft.Value.CanPublish);
        // A published objective with an aligned plan objective beneath it cannot.
        var published = await handler.Handle(new GetGoalDetailQuery(f.CycleId, f.TalentPodObjectiveId, Admin(f.CooId)), default);
        Assert.False(published.Value.CanDelete);
    }
}
