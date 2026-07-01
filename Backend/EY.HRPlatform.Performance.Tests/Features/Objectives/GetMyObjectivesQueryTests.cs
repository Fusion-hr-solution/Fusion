using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Objectives.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Objectives;

public sealed class GetMyObjectivesQueryTests
{
    [Fact]
    public async Task Handle_ReturnsOnlyObjectivesOwnedByCurrentEmployee()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        await using var db = PerformanceTestContext.Create(tenantId, out _);
        db.PerformanceObjectives.AddRange(
            PerformanceObjective.Create(tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, employeeId,
                "Improve onboarding", null, "Completion", "100%", DateTime.UtcNow.AddDays(10), 20),
            PerformanceObjective.Create(tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, Guid.NewGuid(),
                "Improve hiring", null, "Completion", "100%", DateTime.UtcNow.AddDays(10), 20));
        await db.SaveChangesAsync();

        var handler = new GetMyObjectivesQueryHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });

        var result = await handler.Handle(new GetMyObjectivesQuery(), CancellationToken.None);

        Assert.Single(result);
        Assert.Equal(employeeId, result[0].OwnerEmployeeId);
    }
}
