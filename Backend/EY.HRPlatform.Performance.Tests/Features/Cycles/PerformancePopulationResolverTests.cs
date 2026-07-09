using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class PerformancePopulationResolverTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task Resolve_UnionsScopeAndIncludes_ThenRemovesExcludes()
    {
        var orgUnitId = Guid.NewGuid();
        var emp1 = Guid.NewGuid();
        var emp2 = Guid.NewGuid(); // resolved by org scope but explicitly excluded
        var includedEmp = Guid.NewGuid();

        var client = new FakeCoreWorkforceClient
        {
            ByScopeResult =
            [
                FakeCoreWorkforceClient.Employee(emp1, "Org Member One"),
                FakeCoreWorkforceClient.Employee(emp2, "Org Member Two"),
            ],
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(includedEmp, "Explicit Include"),
            ],
        };

        var cycle = TestCycles.Create(
            TenantId, "Cycle", PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        cycle.SetPopulation(false,
        [
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.OrgUnit, orgUnitId, includeDescendants: true),
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.IncludeEmployee, includedEmp),
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.ExcludeEmployee, emp2, reason: "Excluded for review"),
        ]);

        var resolver = new PerformancePopulationResolver(client);
        var members = await resolver.ResolveAsync(cycle, asOf: null, CancellationToken.None);

        var ids = members.Select(m => m.EmployeeId).ToHashSet();
        Assert.Equal(2, ids.Count);
        Assert.Contains(emp1, ids);
        Assert.Contains(includedEmp, ids);
        Assert.DoesNotContain(emp2, ids);
    }

    [Fact]
    public async Task Resolve_WithNoOrgUnitScope_UsesAllActiveBaseline()
    {
        var active1 = Guid.NewGuid();
        var active2 = Guid.NewGuid();
        var excluded = Guid.NewGuid();

        var client = new FakeCoreWorkforceClient
        {
            AllActiveResult =
            [
                FakeCoreWorkforceClient.Employee(active1, "Active One"),
                FakeCoreWorkforceClient.Employee(active2, "Active Two"),
                FakeCoreWorkforceClient.Employee(excluded, "Excluded One"),
            ],
        };

        var cycle = TestCycles.Create(
            TenantId, "All active cycle", PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        cycle.SetPopulation(false,
        [
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.ExcludeEmployee, excluded, reason: "Excluded"),
        ]);

        var resolver = new PerformancePopulationResolver(client);
        var members = await resolver.ResolveAsync(cycle, asOf: null, CancellationToken.None);

        var ids = members.Select(m => m.EmployeeId).ToHashSet();
        Assert.Equal(2, ids.Count);
        Assert.Contains(active1, ids);
        Assert.Contains(active2, ids);
        Assert.DoesNotContain(excluded, ids);
    }

    [Fact]
    public async Task Resolve_WithAsOf_UsesSnapshotEndpointsInsteadOfCurrentWorkforceEndpoints()
    {
        var orgUnitId = Guid.NewGuid();
        var currentEmployeeId = Guid.NewGuid();
        var snapshotEmployeeId = Guid.NewGuid();
        var includedEmployeeId = Guid.NewGuid();
        var asOf = new DateTime(2026, 7, 1, 0, 0, 0, DateTimeKind.Utc);

        var client = new FakeCoreWorkforceClient
        {
            ByScopeResult =
            [
                FakeCoreWorkforceClient.Employee(currentEmployeeId, "Current Only")
            ],
            ResolvePool =
            [
                FakeCoreWorkforceClient.Employee(Guid.NewGuid(), "Current Include")
            ],
            SnapshotByScopeResult =
            [
                FakeCoreWorkforceClient.Employee(snapshotEmployeeId, "Snapshot Member")
            ],
            SnapshotResolvePool =
            [
                FakeCoreWorkforceClient.Employee(includedEmployeeId, "Snapshot Include")
            ]
        };

        var cycle = TestCycles.Create(
            TenantId, "Cycle", PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        cycle.SetPopulation(false,
        [
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.OrgUnit, orgUnitId, includeDescendants: true),
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.IncludeEmployee, includedEmployeeId),
        ]);

        var resolver = new PerformancePopulationResolver(client);
        var members = await resolver.ResolveAsync(cycle, asOf, CancellationToken.None);

        var ids = members.Select(m => m.EmployeeId).ToHashSet();
        Assert.Equal(2, ids.Count);
        Assert.Contains(snapshotEmployeeId, ids);
        Assert.Contains(includedEmployeeId, ids);
        Assert.DoesNotContain(currentEmployeeId, ids);
        Assert.All(client.SnapshotAsOfCalls, recorded => Assert.Equal(asOf, recorded));
    }
}
