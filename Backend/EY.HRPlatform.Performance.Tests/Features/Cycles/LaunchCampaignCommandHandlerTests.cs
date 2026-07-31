using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Services;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Multitenancy;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class LaunchCampaignCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private static CoreEmployeeSummary Member(Guid id, string name, Guid? managerId)
        => new(id, $"E-{id.ToString("N")[..6]}", name, name, $"{name}@test.local", "Engineer", true, null,
            managerId is { } m ? new CoreManagerSummary(m, "Manager", true) : null);

    private static async Task<(Guid CycleId, uint Version, string DbName)> SeedDraftAsync(bool withStrategicObjective = true)
    {
        var dbName = $"launch-{Guid.NewGuid()}";
        await using var seed = PerformanceTestContext.Create(TenantId, out _, dbName);
        var cycle = TestCycles.Create(TenantId, "FY26 Launch", PerformanceCycleType.Annual, Start, End);
        if (withStrategicObjective)
            cycle.AddStrategicObjective("Deliver", null, null);
        seed.PerformanceCycles.Add(cycle);
        await seed.SaveChangesAsync();
        return (cycle.Id, cycle.Version, dbName);
    }

    private static LaunchCampaignCommandHandler CreateHandler(
        PerformanceDbContext db, ITenantContext tenantContext, FakeCoreWorkforceClient client)
        => new(db, tenantContext, new StubCurrentUserContext(),
            new CampaignReadinessResolver(new PerformancePopulationResolver(client), client));

    [Fact]
    public async Task Launch_WithEmptyPopulation_FailsClosed()
    {
        var (cycleId, version, dbName) = await SeedDraftAsync();
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        var handler = CreateHandler(db, tenantContext, new FakeCoreWorkforceClient { AllActiveResult = [] });

        var result = await handler.Handle(new LaunchCampaignCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.NotReadyToLaunch", result.Error.Code);
    }

    [Fact]
    public async Task Launch_WithParticipantMissingApprover_FailsClosed()
    {
        var (cycleId, version, dbName) = await SeedDraftAsync();
        var client = new FakeCoreWorkforceClient
        {
            AllActiveResult = [Member(Guid.NewGuid(), "NoManager", managerId: null)]
        };
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        var handler = CreateHandler(db, tenantContext, client);

        var result = await handler.Handle(new LaunchCampaignCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.NotReadyToLaunch", result.Error.Code);
    }

    [Fact]
    public async Task Launch_WithoutActiveStrategicObjective_FailsClosed()
    {
        var (cycleId, version, dbName) = await SeedDraftAsync(withStrategicObjective: false);
        var client = new FakeCoreWorkforceClient
        {
            AllActiveResult = [Member(Guid.NewGuid(), "Alice", Guid.NewGuid())]
        };
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        var handler = CreateHandler(db, tenantContext, client);

        var result = await handler.Handle(new LaunchCampaignCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.NotReadyToLaunch", result.Error.Code);
    }

    [Fact]
    public async Task Launch_OnCrossTenantCampaign_ReturnsNotFound()
    {
        var (cycleId, version, dbName) = await SeedDraftAsync();
        var otherTenant = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(otherTenant, out var tenantContext, dbName);
        var client = new FakeCoreWorkforceClient { AllActiveResult = [Member(Guid.NewGuid(), "Alice", Guid.NewGuid())] };
        var handler = CreateHandler(db, tenantContext, client);

        var result = await handler.Handle(new LaunchCampaignCommand(cycleId, version), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }
}
