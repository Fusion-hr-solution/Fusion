using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Cycles.Commands;
using EY.HRPlatform.Performance.Features.Cycles.Dtos;
using EY.HRPlatform.Performance.Infrastructure.Notifications;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;

namespace EY.HRPlatform.Performance.Tests.Features.Cycles;

public class SetCyclePopulationCommandHandlerTests
{
    private static readonly Guid TenantId = Guid.NewGuid();

    [Fact]
    public async Task SetPopulation_WithOnlyExclusions_ReturnsValidationFailure()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "FY26 Population",
            PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var expectedVersion = (await db.PerformanceCycles.AsNoTracking().SingleAsync()).Version;

        var handler = new SetCyclePopulationCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext(),
            Options.Create(new ReminderOptions()));

        var result = await handler.Handle(new SetCyclePopulationCommand(
            cycle.Id,
            expectedVersion,
            false,
            [new PopulationRuleInput(PopulationRuleType.ExcludeEmployee.ToString(), Guid.NewGuid(), false)]),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.EmptyPopulationRuleSet", result.Error.Code);
    }

    [Fact]
    public async Task SetPopulation_WithConflictingExplicitRules_ReturnsValidationFailure()
    {
        await using var db = PerformanceTestContext.Create(TenantId, out var tenantContext);
        var cycle = PerformanceCycle.Create(
            TenantId,
            "FY26 Conflicting population",
            PerformanceCycleType.Annual,
            new DateTime(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc));
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var expectedVersion = (await db.PerformanceCycles.AsNoTracking().SingleAsync()).Version;

        var employeeId = Guid.NewGuid();
        var handler = new SetCyclePopulationCommandHandler(
            db,
            tenantContext,
            new StubCurrentUserContext(),
            Options.Create(new ReminderOptions()));

        var result = await handler.Handle(new SetCyclePopulationCommand(
            cycle.Id,
            expectedVersion,
            false,
            [
                new PopulationRuleInput(PopulationRuleType.IncludeEmployee.ToString(), employeeId, false),
                new PopulationRuleInput(PopulationRuleType.ExcludeEmployee.ToString(), employeeId, false),
            ]),
            CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("Cycle.ConflictingPopulationRule", result.Error.Code);
    }
}
