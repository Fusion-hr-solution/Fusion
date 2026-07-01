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

        var cycle = PerformanceCycle.Create(
            TenantId, "Cycle", PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        cycle.SetPopulation(false,
        [
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.OrgUnit, orgUnitId, includeDescendants: true),
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.IncludeEmployee, includedEmp),
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.ExcludeEmployee, emp2),
        ]);

        var resolver = new PerformancePopulationResolver(client);
        var members = await resolver.ResolveAsync(cycle, CancellationToken.None);

        var ids = members.Select(m => m.EmployeeId).ToHashSet();
        Assert.Equal(2, ids.Count);
        Assert.Contains(emp1, ids);
        Assert.Contains(includedEmp, ids);
        Assert.DoesNotContain(emp2, ids);
    }
}
