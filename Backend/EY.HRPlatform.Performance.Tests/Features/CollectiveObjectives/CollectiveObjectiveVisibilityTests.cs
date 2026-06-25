using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.Performance.Tests.Features.CollectiveObjectives;

public sealed class CollectiveObjectiveVisibilityTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _otherTenantId = Guid.NewGuid();

    private PerformanceDbContext CreateContext(string dbName, Guid tenantId)
    {
        var tc = new TenantContext();
        tc.SetTenant(tenantId);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new PerformanceDbContext(options, tc);
    }

    private static ClaimsPrincipal BuildUserWithPermission(Guid? employeeId = null, params string[] permissions)
    {
        var builder = new ClaimsPrincipalBuilder();
        if (employeeId.HasValue)
            builder.WithEmployeeId(employeeId.Value);
        foreach (var perm in permissions)
            builder.WithPermission(perm, PermissionScopes.Tenant);
        return builder.Build();
    }

    private GetCollectiveObjectivesQueryHandler CreateHandler(
        PerformanceDbContext dbContext,
        ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext { User = user };
        return new GetCollectiveObjectivesQueryHandler(
            dbContext,
            new PerformanceAccessPolicyService(),
            new HttpContextAccessor { HttpContext = httpContext });
    }

    [Fact]
    public async Task Handle_ForeignTenant_ReturnsZeroRows()
    {
        // Tenant A has a collective objective
        var dbName = $"test-{Guid.NewGuid()}";
        using var seedDb = CreateContext(dbName, _tenantId);
        var cycle = PerformanceCycle.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        seedDb.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            Guid.NewGuid(), "Goal", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m);
        seedDb.PerformanceObjectives.Add(obj);
        await seedDb.SaveChangesAsync();

        // Tenant B queries — should see zero rows (tenant fail-closed)
        using var queryDb = CreateContext(dbName, _otherTenantId);
        var user = BuildUserWithPermission(null, PerformancePermissions.ObjectiveTeamManage);
        var handler = CreateHandler(queryDb, user);

        var result = await handler.Handle(new GetCollectiveObjectivesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Empty(result.Value);
    }

    [Fact]
    public async Task Handle_NoPermission_ReturnsForbidden()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var user = new ClaimsPrincipalBuilder().Build(); // no permissions
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(new GetCollectiveObjectivesQuery(), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WithPermission_ReturnsCollectiveWithProvenance()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);

        var period = StrategicPeriod.Create(_tenantId, "FY2026", 2026, PeriodGranularity.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.StrategicPeriods.Add(period);

        var strategic = StrategicObjective.Create(_tenantId, period.Id, "Company", "Strategic Goal", "Strategic Description");
        strategic.Publish(DateTime.UtcNow);
        db.StrategicObjectives.Add(strategic);

        var cycle = PerformanceCycle.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            Guid.NewGuid(), "Collective Goal", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m, strategic.Id);
        db.PerformanceObjectives.Add(obj);
        await db.SaveChangesAsync();

        var user = BuildUserWithPermission(null, PerformancePermissions.ObjectiveTeamManage);
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(new GetCollectiveObjectivesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Single(result.Value);

        var dto = result.Value[0];
        Assert.Equal(strategic.Id, dto.ParentStrategicId);
        Assert.Equal("Strategic Goal", dto.ParentStrategicTitle);
        Assert.Equal("Collective Goal", dto.Title);
    }

    [Fact]
    public async Task Handle_ProvenanceVisible_ContentNotExposed()
    {
        // D-15: provenance (parent id/title) visible but parent Description/body NOT exposed
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);

        var period = StrategicPeriod.Create(_tenantId, "FY2026", 2026, PeriodGranularity.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.StrategicPeriods.Add(period);

        var strategic = StrategicObjective.Create(_tenantId, period.Id, "Company", "Goal", "Secret Body");
        strategic.Publish(DateTime.UtcNow);
        db.StrategicObjectives.Add(strategic);

        var cycle = PerformanceCycle.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            Guid.NewGuid(), "Collective", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m, strategic.Id);
        db.PerformanceObjectives.Add(obj);
        await db.SaveChangesAsync();

        var user = BuildUserWithPermission(null, PerformancePermissions.ObjectiveTeamManage);
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(new GetCollectiveObjectivesQuery(), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var dto = result.Value[0];
        Assert.Equal(strategic.Id, dto.ParentStrategicId);
        Assert.Equal("Goal", dto.ParentStrategicTitle);
        // The DTO does NOT expose a Description/Body field from the strategic parent
        // (CollectiveObjectiveDto has no strategic parent Description field)
    }
}
