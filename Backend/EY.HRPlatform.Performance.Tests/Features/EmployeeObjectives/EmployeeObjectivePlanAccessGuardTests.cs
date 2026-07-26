using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.EmployeeObjectives;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.EmployeeObjectives;

public class EmployeeObjectivePlanAccessGuardTests
{
    private static readonly DateTime Start = new(2026, 1, 1, 0, 0, 0, DateTimeKind.Utc);
    private static readonly DateTime End = new(2026, 12, 31, 0, 0, 0, DateTimeKind.Utc);

    private static PerformanceCycle NewLaunched(Guid tenantId, Guid employeeId)
    {
        var cycle = TestCycles.Create(tenantId, "FY26 Objectives", PerformanceCycleType.Annual, Start, End);
        cycle.AddStrategicObjective("Improve client delivery", null, "Consulting");
        cycle.Launch(
            [new ResolvedLaunchParticipant(employeeId, "Alice Employee", Guid.NewGuid(), "Mia Manager", false, null)],
            Start.AddDays(1));
        return cycle;
    }

    [Fact]
    public async Task RequireParticipantAsync_WithoutEmployeeLink_FailsClosed()
    {
        var tenantId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var guard = new EmployeeObjectivePlanAccessGuard(db, new StubCurrentUserContext { EmployeeId = null });

        var result = await guard.RequireParticipantAsync(Guid.NewGuid(), CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("EmployeeObjectivePlan.EmployeeContextForbidden", result.Error.Code);
    }

    [Fact]
    public async Task RequireParticipantAsync_WithoutFrozenParticipant_IsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var dbName = $"objective-access-{Guid.NewGuid()}";
        Guid cycleId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var cycle = NewLaunched(tenantId, Guid.NewGuid());
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            cycleId = cycle.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var guard = new EmployeeObjectivePlanAccessGuard(db, new StubCurrentUserContext { EmployeeId = employeeId });

        var result = await guard.RequireParticipantAsync(cycleId, CancellationToken.None);

        Assert.True(result.IsFailure);
        Assert.Equal("EmployeeObjectivePlan.NotParticipantForbidden", result.Error.Code);
    }

    [Fact]
    public async Task RequireParticipantAsync_ReturnsFrozenParticipantForActingEmployee()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var dbName = $"objective-access-{Guid.NewGuid()}";
        Guid cycleId;

        await using (var seed = PerformanceTestContext.Create(tenantId, out _, dbName))
        {
            var cycle = NewLaunched(tenantId, employeeId);
            seed.PerformanceCycles.Add(cycle);
            await seed.SaveChangesAsync();
            cycleId = cycle.Id;
        }

        await using var db = PerformanceTestContext.Create(tenantId, out _, dbName);
        var guard = new EmployeeObjectivePlanAccessGuard(db, new StubCurrentUserContext { EmployeeId = employeeId });

        var result = await guard.RequireParticipantAsync(cycleId, CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(employeeId, result.Value.EmployeeId);
        Assert.Equal(cycleId, result.Value.CycleId);
    }
}
