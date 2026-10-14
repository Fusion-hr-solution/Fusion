using System.Net;
using System.Net.Http.Json;
using EY.HRPlatform.Performance.Domain.Cycles;
using EY.HRPlatform.Performance.Domain.Objectives;
using EY.HRPlatform.Performance.Tests.TestHelpers;
using EY.HRPlatform.SharedKernel.Auth;

namespace EY.HRPlatform.Performance.Tests;

public sealed class ArchiveHttpTests
{
    [Theory]
    [InlineData(false, true, HttpStatusCode.Forbidden)]
    [InlineData(true, false, HttpStatusCode.Forbidden)]
    [InlineData(true, true, HttpStatusCode.OK)]
    public async Task Company_archive_requires_entitlement_and_strategy_authority(bool entitled, bool authority, HttpStatusCode expected)
    {
        await using var factory = new PerformanceApiFactory();
        var start = new DateOnly(2026, 1, 1); var end = start.AddYears(1);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "Archive", start, end, start.AddDays(30));
        var objective = Objective.CreateStrategic(factory.Store.TenantId, cycle.Id, "Direction", null, Guid.NewGuid(), start, end, ObjectiveMeasurement.ManualPercentage(), start, end);
        objective.Publish();
        await using (var db = factory.Store.NewContext()) { db.Cycles.Add(cycle); db.Objectives.Add(objective); await db.SaveChangesAsync(); }
        using var client = factory.CreateAuthenticatedClient(modules: entitled ? [ModuleEntitlements.Performance] : [], permissions:
            authority ? [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.StrategyPublish, PermissionScopes.Tenant)] : [new(PerformancePermissions.CycleView, PermissionScopes.Tenant)]);
        using var response = await client.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/strategy/{objective.Id}/archive", new { expectedVersion = objective.Version });
        Assert.Equal(expected, response.StatusCode);
        await using var verify = factory.Store.NewContext();
        Assert.Equal(expected == HttpStatusCode.OK ? ObjectiveLifecycleState.Archived : ObjectiveLifecycleState.Published, (await verify.Objectives.FindAsync(objective.Id))!.State);
    }
    [Fact]
    public async Task Company_archive_cannot_reach_another_tenants_cycle()
    {
        await using var factory = new PerformanceApiFactory();
        var start = new DateOnly(2026, 1, 1); var end = start.AddYears(1);
        var cycle = PerformanceCycle.CreateDraft(factory.Store.TenantId, "Own", start, end, start.AddDays(30));
        var objective = Objective.CreateStrategic(factory.Store.TenantId, cycle.Id, "Direction", null, Guid.NewGuid(), start, end, ObjectiveMeasurement.ManualPercentage(), start, end);
        objective.Publish();
        await using (var db = factory.Store.NewContext()) { db.Cycles.Add(cycle); db.Objectives.Add(objective); await db.SaveChangesAsync(); }
        using var client = factory.CreateAuthenticatedClient(tenantId: Guid.NewGuid(), permissions:
            [new(PerformancePermissions.CycleView, PermissionScopes.Tenant), new(PerformancePermissions.StrategyPublish, PermissionScopes.Tenant)]);
        using var response = await client.PostAsJsonAsync($"/api/performance/cycles/{cycle.Id}/strategy/{objective.Id}/archive", new { expectedVersion = objective.Version });
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        await using var verify = factory.Store.NewContext();
        Assert.Equal(ObjectiveLifecycleState.Published, (await verify.Objectives.FindAsync(objective.Id))!.State);
    }

}
