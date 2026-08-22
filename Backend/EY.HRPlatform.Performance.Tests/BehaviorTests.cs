using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Domain.Population;
using EY.HRPlatform.Performance.Domain.Settings;
using EY.HRPlatform.Performance.Features.Cycles;
using EY.HRPlatform.Performance.Features.Population;
using EY.HRPlatform.Performance.Models;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using Microsoft.EntityFrameworkCore;

namespace EY.HRPlatform.Performance.Tests;

public sealed class BehaviorTests
{
    private static readonly DateOnly Start = new(2026, 1, 1);
    private static readonly DateOnly End = new(2026, 12, 31);

    private static async Task<(TestStore Store, FakeCoreWorkforceClient Workforce, Guid CycleId)> ArrangeAsync()
    {
        var store = TestStore.ForNewTenant();
        var cycle = PerformanceCycle.CreateDraft(store.TenantId, "FY2026", Start, End, Start.AddDays(30));
        await using var db = store.NewContext();
        db.Cycles.Add(cycle);
        await db.SaveChangesAsync();
        return (store, new FakeCoreWorkforceClient(), cycle.Id);
    }

    [Fact]
    public async Task Eligibility_is_resolved_as_of_the_cycle_start_date()
    {
        var (store, workforce, cycleId) = await ArrangeAsync();
        workforce.Add("Amina", orgUnitId: Guid.NewGuid());

        await using var db = store.NewContext();
        var result = await new GetPopulationHandler(db, store.Tenant, new PopulationResolutionService(workforce))
            .Handle(new GetPopulationQuery(cycleId), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(Start.ToDateTime(TimeOnly.MinValue), workforce.LastAsOf);
        Assert.Single(result.Value.Candidates);
    }

    [Fact]
    public async Task Inclusion_cannot_override_invalid_employment_or_assignment()
    {
        var (store, workforce, cycleId) = await ArrangeAsync();
        workforce.Add("Amina", orgUnitId: Guid.NewGuid());
        workforce.AddIneligible("Ghost", inactive: true, noAssignment: true, out var ghostId);
        var resolver = new PopulationResolutionService(workforce);

        await using (var db = store.NewContext())
        {
            var set = await new SetPopulationHandler(db, store.Tenant, resolver).Handle(
                new SetPopulationCommand(cycleId, new SetPopulationRequest(PopulationMode.AllActive, [], [ghostId], [])), default);
            Assert.True(set.IsSuccess);
            var ghost = set.Value.Candidates.Single(candidate => candidate.EmployeeId == ghostId);
            Assert.False(ghost.IsEligible);
            Assert.False(ghost.CountsToRoster);
        }

        await using (var db = store.NewContext())
        {
            var confirm = await new ConfirmPopulationHandler(db, store.Tenant, resolver).Handle(
                new ConfirmPopulationCommand(cycleId), default);
            Assert.True(confirm.IsFailure);
            Assert.Contains("attention", confirm.Error.Message, StringComparison.OrdinalIgnoreCase);
        }
    }

    [Fact]
    public async Task Setting_scope_then_adding_units_on_an_existing_definition_persists()
    {
        var (store, workforce, cycleId) = await ArrangeAsync();
        var org = Guid.NewGuid();
        workforce.Add("Amina", orgUnitId: org);
        var resolver = new PopulationResolutionService(workforce);

        // GET first persists a default definition, so the next Set mutates an existing one.
        await using (var db = store.NewContext())
        {
            await new GetPopulationHandler(db, store.Tenant, resolver).Handle(new GetPopulationQuery(cycleId), default);
        }

        // Switching to ByScope with no units is a valid empty intermediate state.
        await using (var db = store.NewContext())
        {
            var empty = await new SetPopulationHandler(db, store.Tenant, resolver).Handle(
                new SetPopulationCommand(cycleId, new SetPopulationRequest(PopulationMode.ByScope, [], [], [])), default);
            Assert.True(empty.IsSuccess);
            Assert.Empty(empty.Value.Candidates);
        }

        // Then adding a unit to the existing definition must persist and resolve.
        await using (var db = store.NewContext())
        {
            var scoped = await new SetPopulationHandler(db, store.Tenant, resolver).Handle(
                new SetPopulationCommand(cycleId, new SetPopulationRequest(
                    PopulationMode.ByScope, [new OrgUnitSelectionInput(org, true)], [], [])), default);
            Assert.True(scoped.IsSuccess, scoped.IsFailure ? scoped.Error.Message : null);
            Assert.Single(scoped.Value.Candidates);
        }
    }

    [Fact]
    public async Task Activation_is_blocked_without_published_strategy_or_confirmed_population()
    {
        var (store, _, cycleId) = await ArrangeAsync();

        await using var db = store.NewContext();
        var result = await new ActivateCycleHandler(db).Handle(new ActivateCycleCommand(cycleId), default);

        Assert.True(result.IsFailure);
        Assert.Contains("strategic objective", result.Error.Message, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Full_setup_activates_and_freezes_an_immutable_snapshot()
    {
        var (store, workforce, cycleId) = await ArrangeAsync();
        var resolver = new PopulationResolutionService(workforce);
        workforce.Add("Amina", orgUnitId: Guid.NewGuid(), managerId: Guid.NewGuid());

        // Settings + published strategy.
        await using (var db = store.NewContext())
        {
            db.CycleSettings.Add(CycleSettings.CreateDefault(store.TenantId));
            var strategy = Objective.CreateStrategic(store.TenantId, cycleId, "Grow revenue", null, Guid.NewGuid(),
                Start, End, ObjectiveMeasurement.NumericTarget(1000m, 1300m, "k€", ImprovementDirection.Increase), Start, End);
            strategy.Publish();
            db.Objectives.Add(strategy);
            await db.SaveChangesAsync();
        }

        // Population: one eligible employee, then confirm.
        await using (var db = store.NewContext())
        {
            await new SetPopulationHandler(db, store.Tenant, resolver).Handle(
                new SetPopulationCommand(cycleId, new SetPopulationRequest(PopulationMode.AllActive, [], [], [])), default);
        }
        await using (var db = store.NewContext())
        {
            var confirm = await new ConfirmPopulationHandler(db, store.Tenant, resolver).Handle(new ConfirmPopulationCommand(cycleId), default);
            Assert.True(confirm.IsSuccess);
        }

        // Activate.
        string frozenSettings;
        await using (var db = store.NewContext())
        {
            var activate = await new ActivateCycleHandler(db).Handle(new ActivateCycleCommand(cycleId), default);
            Assert.True(activate.IsSuccess, activate.IsFailure ? activate.Error.Message : null);
            Assert.Equal(CycleLifecycleState.Active, activate.Value.Cycle.State);
        }

        await using (var db = store.NewContext())
        {
            var activated = await db.Cycles.Include(c => c.ActivationSnapshot).AsNoTracking().FirstAsync(c => c.Id == cycleId);
            Assert.NotNull(activated.ActivationSnapshot);
            Assert.Equal(1, activated.ActivationSnapshot!.ConfirmedParticipantCount);
            frozenSettings = activated.ActivationSnapshot.SettingsJson;
        }

        // Later settings change must not alter the frozen snapshot.
        await using (var db = store.NewContext())
        {
            var settings = await db.CycleSettings.FirstAsync();
            settings.Update(MeasurementMethod.ManualPercentage, 1, 2, 15, false);
            await db.SaveChangesAsync();
        }

        await using (var db = store.NewContext())
        {
            var reread = await db.Cycles.Include(c => c.ActivationSnapshot).AsNoTracking().FirstAsync(c => c.Id == cycleId);
            Assert.Equal(frozenSettings, reread.ActivationSnapshot!.SettingsJson);
        }
    }

    [Fact]
    public async Task Cycles_are_tenant_isolated_and_fail_closed()
    {
        var store = TestStore.ForNewTenant();

        await using (var db = store.NewContext())
        {
            db.Cycles.Add(PerformanceCycle.CreateDraft(store.TenantId, "FY2026", Start, End, Start.AddDays(30)));
            await db.SaveChangesAsync();
            Assert.Single(await db.Cycles.ToListAsync());
        }

        // A different tenant sees nothing in the same store.
        await using (var db = store.NewContext(TestTenantContext.WithTenant(Guid.NewGuid())))
        {
            Assert.Empty(await db.Cycles.ToListAsync());
        }

        // An unresolved tenant context is fail-closed.
        await using (var db = store.NewContext(TestTenantContext.Unresolved()))
        {
            Assert.Empty(await db.Cycles.ToListAsync());
        }
    }
}
