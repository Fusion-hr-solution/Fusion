using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Results;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class SetCyclePopulationCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    private static async Task<Result<PerformanceCycleDetailDto>> RunAsync(string name, params PopulationRuleInput[] rules)
    {
        var dbName = $"set-population-{Guid.NewGuid()}";
        Guid cycleId;
        uint version;

        // Seed with one context; execute with a separate context sharing the DB (request-per-context).
        await using (var seedDb = PerformanceTestContext.Create(TenantId, out _, dbName))
        {
            var cycle = TestCycles.Create(
                TenantId, name, PerformanceCycleType.Annual,
                new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
            seedDb.PerformanceCycles.Add(cycle);
            await seedDb.SaveChangesAsync();
            cycleId = cycle.Id;
            version = cycle.Version;
        }

        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext, dbName);
        var handler = new SetCyclePopulationCommandHandler(
            db, tenantContext, new StubCurrentUserContext(), Options.Create(new ReminderOptions()));

        return await handler.Handle(
            new SetCyclePopulationCommand(cycleId, version, false, rules), CancellationToken.None);
    }

    [Fact]
    public async Task SetPopulation_WithNoScope_IsAllActiveBaseline_Succeeds()
        => Assert.True((await RunAsync("FY26 All active")).IsSuccess);

    [Fact]
    public async Task SetPopulation_ExclusionWithoutReason_ReturnsValidationFailure()
    {
        var result = await RunAsync("FY26 Exclusion no reason",
            new PopulationRuleInput(PopulationRuleType.ExcludeEmployee.ToString(), Guid.NewGuid(), false, null));

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.ExclusionReasonRequired", result.Error.Code);
    }

    [Fact]
    public async Task SetPopulation_WithConflictingExplicitRules_ReturnsValidationFailure()
    {
        var employeeId = Guid.NewGuid();
        var result = await RunAsync("FY26 Conflicting population",
            new PopulationRuleInput(PopulationRuleType.IncludeEmployee.ToString(), employeeId, false),
            new PopulationRuleInput(PopulationRuleType.ExcludeEmployee.ToString(), employeeId, false, "Duplicate"));

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.ConflictingPopulationRule", result.Error.Code);
    }
}
