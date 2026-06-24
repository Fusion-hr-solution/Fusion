using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using EY.HRPlatform.SharedKernel.Results;
using MediatR;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.Performance.Tests.Features.CollectiveObjectives;

public sealed class CreateCollectiveObjectiveTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _ownerEmployeeId = Guid.NewGuid();

    private PerformanceDbContext CreateContext(string dbName)
    {
        var tc = new TenantContext();
        tc.SetTenant(_tenantId);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new PerformanceDbContext(options, tc);
    }

    private PerformanceCycle CreateActiveCycle(Guid tenantId, bool requireApproval = false)
    {
        var cycle = PerformanceCycle.Create(
            tenantId, "Test Cycle", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        cycle.ConfigureGovernance(
            Guid.NewGuid(), requireApproval, 3,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, DateTime.UtcNow);
        cycle.MarkReadyToLaunch(finalResponsibilityCount: 1, readinessFailureCount: 0,
            hasAcceptedWorkforceDelta: true, DateTime.UtcNow);
        cycle.Activate(DateTime.UtcNow);
        return cycle;
    }

    private static StrategicObjective CreatePublishedStrategic(Guid tenantId, Guid periodId)
    {
        var strategic = StrategicObjective.Create(tenantId, periodId, "Company", "Strategic Goal", "Desc");
        strategic.Publish(DateTime.UtcNow);
        return strategic;
    }

    private static ClaimsPrincipal BuildUserWithPermission(params string[] permissions)
    {
        var builder = new ClaimsPrincipalBuilder();
        foreach (var perm in permissions)
            builder.WithPermission(perm, PermissionScopes.Tenant);
        return builder.Build();
    }

    private CreateCollectiveObjectiveCommandHandler CreateHandler(
        PerformanceDbContext dbContext,
        ICoreWorkforceClient? workforceClient = null,
        ClaimsPrincipal? user = null,
        ISender? sender = null)
    {
        var fakeClient = workforceClient ?? new FakeCoreWorkforceClient();
        var principal = user ?? BuildUserWithPermission(PerformancePermissions.ObjectiveTeamManage);
        var httpContext = new DefaultHttpContext { User = principal };

        return new CreateCollectiveObjectiveCommandHandler(
            dbContext,
            new StubCurrentUserContext { EmployeeId = _ownerEmployeeId, FullName = "Manager" },
            new PerformanceAccessPolicyService(),
            fakeClient,
            new HttpContextAccessor { HttpContext = httpContext },
            sender ?? new MockSender());
    }

    [Fact]
    public async Task Handle_CycleNotActive_ReturnsConflict()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}");
        var cycle = PerformanceCycle.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var result = await handler.Handle(
            new CreateCollectiveObjectiveCommand(cycle.Id, Guid.NewGuid(), Guid.NewGuid(),
                "Title", null, null, null), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("CycleNotActive", result.Error.Code);
    }

    [Fact]
    public async Task Handle_StrategicParentNotPublished_ReturnsValidation()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}");
        var cycle = CreateActiveCycle(_tenantId);
        db.PerformanceCycles.Add(cycle);

        var period = StrategicPeriod.Create(_tenantId, "FY2026", 2026, PeriodGranularity.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.StrategicPeriods.Add(period);
        var strategic = StrategicObjective.Create(_tenantId, period.Id, "Company", "Goal", null);
        db.StrategicObjectives.Add(strategic);
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var result = await handler.Handle(
            new CreateCollectiveObjectiveCommand(cycle.Id, Guid.NewGuid(), strategic.Id,
                "Title", null, null, null), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("AlignmentRequired", result.Error.Code);
    }

    [Fact]
    public async Task Handle_StrategicParentNotFound_ReturnsNotFound()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}");
        var cycle = CreateActiveCycle(_tenantId);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var handler = CreateHandler(db);
        var result = await handler.Handle(
            new CreateCollectiveObjectiveCommand(cycle.Id, Guid.NewGuid(), Guid.NewGuid(),
                "Title", null, null, null), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Handle_NoPermission_ReturnsForbidden()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}");
        var cycle = CreateActiveCycle(_tenantId);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();

        var user = new ClaimsPrincipalBuilder().Build(); // no permissions
        var handler = CreateHandler(db, user: user);
        var result = await handler.Handle(
            new CreateCollectiveObjectiveCommand(cycle.Id, Guid.NewGuid(), Guid.NewGuid(),
                "Title", null, null, null), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("Forbidden", result.Error.Code);
    }

    [Fact]
    public async Task Handle_ValidInput_CreatesTeamObjective()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}");
        var cycle = CreateActiveCycle(_tenantId);
        db.PerformanceCycles.Add(cycle);

        var period = StrategicPeriod.Create(_tenantId, "FY2026", 2026, PeriodGranularity.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.StrategicPeriods.Add(period);
        var strategic = CreatePublishedStrategic(_tenantId, period.Id);
        db.StrategicObjectives.Add(strategic);

        var orgUnitId = Guid.NewGuid();
        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.OrgUnitDetails[orgUnitId] = new CoreOrgUnitDetail(
            orgUnitId, "ENG", "Engineering", "Department", null, _ownerEmployeeId, true);
        await db.SaveChangesAsync();

        var sender = new MockSender();
        var handler = CreateHandler(db, fakeClient, sender: sender);

        var result = await handler.Handle(
            new CreateCollectiveObjectiveCommand(cycle.Id, orgUnitId, strategic.Id,
                "Collective Goal", "Description", 50m, DateTime.UtcNow.AddDays(20)),
            CancellationToken.None);

        Assert.True(result.IsSuccess);

        var obj = await db.PerformanceObjectives.FindAsync(result.Value);
        Assert.NotNull(obj);
        Assert.Equal(ObjectiveLevel.Team, obj!.Level);
        Assert.Equal(strategic.Id, obj.ParentObjectiveId);
        Assert.Equal(_ownerEmployeeId, obj.OwnerEmployeeId);
    }

    [Fact]
    public async Task Handle_AfterSupersede_ParentObjectiveIdUnchanged()
    {
        // D-04: superseding a strategic version must not rewrite the collective's frozen alignment
        var db = CreateContext($"test-{Guid.NewGuid()}");
        var cycle = CreateActiveCycle(_tenantId);
        db.PerformanceCycles.Add(cycle);

        var period = StrategicPeriod.Create(_tenantId, "FY2026", 2026, PeriodGranularity.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.StrategicPeriods.Add(period);
        var strategicV1 = CreatePublishedStrategic(_tenantId, period.Id);
        db.StrategicObjectives.Add(strategicV1);

        var orgUnitId = Guid.NewGuid();
        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.OrgUnitDetails[orgUnitId] = new CoreOrgUnitDetail(
            orgUnitId, "ENG", "Engineering", "Department", null, _ownerEmployeeId, true);
        await db.SaveChangesAsync();

        var sender = new MockSender();
        var handler = CreateHandler(db, fakeClient, sender: sender);

        // Create collective aligned to V1
        var result = await handler.Handle(
            new CreateCollectiveObjectiveCommand(cycle.Id, orgUnitId, strategicV1.Id,
                "Collective Goal", null, null, null), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var obj = await db.PerformanceObjectives.FindAsync(result.Value);
        Assert.Equal(strategicV1.Id, obj!.ParentObjectiveId);

        // Supersede V1 with V2
        var strategicV2 = StrategicObjective.Create(_tenantId, period.Id, "Company", "Goal V2", null);
        strategicV2.SetVersionNumber(2);
        strategicV1.Supersede(strategicV2.Id, DateTime.UtcNow);
        strategicV2.Publish(DateTime.UtcNow);
        db.StrategicObjectives.Add(strategicV2);
        await db.SaveChangesAsync();

        // Verify collective's ParentObjectiveId is unchanged (frozen alignment D-04)
        var objAfter = await db.PerformanceObjectives.FindAsync(result.Value);
        Assert.Equal(strategicV1.Id, objAfter!.ParentObjectiveId);
    }
}

/// <summary>Minimal ISender mock that returns success for any command/query.</summary>
internal sealed class MockSender : ISender
{
    public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
    {
        // For RouteCollectiveApprovalCommand, return success
        if (typeof(TResponse) == typeof(Result))
            return Task.FromResult((TResponse)(object)Result.Success());

        if (typeof(TResponse).IsGenericType && typeof(TResponse).GetGenericTypeDefinition() == typeof(Result<>))
        {
            var valueType = typeof(TResponse).GetGenericArguments()[0];
            var successMethod = typeof(Result<>).MakeGenericType(valueType).GetMethods()
                .First(m => m.Name == "Success" && m.GetParameters().Length == 0);
            return Task.FromResult((TResponse)successMethod.Invoke(null, null)!);
        }

        throw new NotImplementedException($"MockSender does not handle {typeof(TResponse).Name}");
    }

    public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default)
        where TRequest : IRequest
        => Task.CompletedTask;

    public Task<object?> Send(object request, CancellationToken cancellationToken = default)
        => Task.FromResult<object?>(null);

    public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
        => throw new NotImplementedException();

    public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
        => throw new NotImplementedException();
}
