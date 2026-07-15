using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Features.Cycles.Queries;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class GetCycleReadinessQueryTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private static CoreEmployeeSummary Member(Guid id, string name, Guid? managerId, bool managerActive = true)
        => new(id, $"E-{id.ToString("N")[..6]}", name, name, $"{name}@test.local", "Engineer", true, null,
            managerId is { } m ? new CoreManagerSummary(m, $"{name}'s Manager", managerActive) : null);

    private static void AddOrgScope(PerformanceCycle cycle)
        => cycle.SetPopulation(false,
        [
            PerformanceCyclePopulationRule.Create(TenantId, PopulationRuleType.OrgUnit, Guid.NewGuid(), includeDescendants: true)
        ]);

    private static async Task<CycleReadinessDto> RunAsync(FakeCoreWorkforceClient client, bool withStrategicObjective = true, Action<PerformanceCycle>? configure = null)
    {
        var dbName = $"readiness-{Guid.NewGuid()}";
        Guid cycleId;
        await using (var seed = PerformanceTestContext.Create(TenantId, out _, dbName))
        {
            var cycle = TestCycles.Create(TenantId, "FY26 Readiness", PerformanceCycleType.Annual, Start, End);
            if (withStrategicObjective)
                cycle.AddStrategicObjective("Deliver", null, null);
            configure?.Invoke(cycle);
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            cycleId = cycle.Id;
        }

        await using var db = PerformanceTestContext.Create(TenantId, out _, dbName);
        var resolver = new CampaignReadinessResolver(new PerformancePopulationResolver(client), client);
        var handler = new GetCycleReadinessQueryHandler(db, resolver);
        var result = await handler.Handle(new GetCycleReadinessQuery(cycleId), CancellationToken.None);
        Assert.True(result.IsSuccess);
        return result.Value;
    }

    [Fact]
    public async Task Readiness_AllParticipantsHaveManagers_CanLaunch()
    {
        var client = new FakeCoreWorkforceClient
        {
            ByScopeResult =
            [
                Member(Guid.NewGuid(), "Alice", Guid.NewGuid()),
                Member(Guid.NewGuid(), "Bob", Guid.NewGuid()),
            ]
        };

        var readiness = await RunAsync(client, configure: AddOrgScope);

        Assert.True(readiness.CanLaunch);
        Assert.False(readiness.IsAllActiveBaseline);
        Assert.Equal(2, readiness.IncludedCount);
        Assert.All(readiness.Participants, p => Assert.True(p.HasApprover));
        Assert.Empty(readiness.BlockingConditions);
    }

    [Fact]
    public async Task Readiness_NoPositivePopulationScope_IsBlocking()
    {
        var client = new FakeCoreWorkforceClient
        {
            AllActiveResult =
            [
                Member(Guid.NewGuid(), "Alice", Guid.NewGuid()),
                Member(Guid.NewGuid(), "Bob", Guid.NewGuid()),
            ]
        };

        var readiness = await RunAsync(client);

        Assert.False(readiness.CanLaunch);
        Assert.True(readiness.IsAllActiveBaseline);
        Assert.Equal(0, readiness.IncludedCount);
        Assert.Contains(readiness.BlockingConditions, c => c.Code == "PopulationScopeRequired");
    }

    [Fact]
    public async Task Readiness_ParticipantWithoutManager_IsBlocking()
    {
        var client = new FakeCoreWorkforceClient
        {
            ByScopeResult =
            [
                Member(Guid.NewGuid(), "Alice", Guid.NewGuid()),
                Member(Guid.NewGuid(), "NoManager", managerId: null),
            ]
        };

        var readiness = await RunAsync(client, configure: AddOrgScope);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.BlockingConditions, c => c.Code == "MissingApprover");
    }

    [Fact]
    public async Task Readiness_EmptyPopulation_IsBlocking()
    {
        var readiness = await RunAsync(new FakeCoreWorkforceClient { ByScopeResult = [] }, configure: AddOrgScope);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.BlockingConditions, c => c.Code == "NoParticipants");
    }

    [Fact]
    public async Task Readiness_NoActiveStrategicObjective_IsBlocking()
    {
        var client = new FakeCoreWorkforceClient
        {
            ByScopeResult = [Member(Guid.NewGuid(), "Alice", Guid.NewGuid())]
        };

        var readiness = await RunAsync(client, withStrategicObjective: false, configure: AddOrgScope);

        Assert.False(readiness.CanLaunch);
        Assert.Contains(readiness.BlockingConditions, c => c.Code == "NoActiveStrategicObjective");
    }

    [Fact]
    public async Task Readiness_InactiveDefaultApprover_IsInformationalNotBlocking()
    {
        var client = new FakeCoreWorkforceClient
        {
            ByScopeResult = [Member(Guid.NewGuid(), "Alice", Guid.NewGuid(), managerActive: false)]
        };

        var readiness = await RunAsync(client, configure: AddOrgScope);

        Assert.True(readiness.CanLaunch);
        Assert.Contains(readiness.InformationalConditions, c => c.Code == "ApproverInactive");
    }
}
