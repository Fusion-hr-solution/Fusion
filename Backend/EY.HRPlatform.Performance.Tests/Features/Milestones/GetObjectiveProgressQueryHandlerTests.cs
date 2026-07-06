using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Milestones.Queries;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using Microsoft.AspNetCore.Http;

namespace EY.HRPlatform.Performance.Tests.Features.Milestones;

public sealed class GetObjectiveProgressQueryHandlerTests
{
    private sealed class StubAccessPolicy(bool canCorrectProgress) : IPerformanceAccessPolicyService
    {
        public bool CanCorrectObjectiveProgress(ClaimsPrincipal user) => canCorrectProgress;
        public bool CanViewCycles(ClaimsPrincipal user) => false;
        public bool CanManageCycles(ClaimsPrincipal user) => false;
        public bool CanOperateCycles(ClaimsPrincipal user) => false;
        public bool CanViewStrategicObjectives(ClaimsPrincipal user) => false;
        public bool CanManageStrategicObjectives(ClaimsPrincipal user) => false;
        public bool CanPublishStrategicObjectives(ClaimsPrincipal user) => false;
        public bool CanViewCollectiveObjectives(ClaimsPrincipal user) => false;
        public bool CanApproveCollectiveObjectives(ClaimsPrincipal user) => false;
        public bool CanAccessConfidentialFeedbackIdentity(ClaimsPrincipal user) => false;
        public bool CanViewFeedbackThresholdDetails(ClaimsPrincipal user) => false;
    }

    private sealed class StubHttpContextAccessor : IHttpContextAccessor
    {
        public HttpContext? HttpContext { get; set; } = new DefaultHttpContext
        {
            User = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())], "Test"))
        };
    }

    [Fact]
    public async Task GetProgress_Owner_ReturnsObjectiveProgress()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var objective = await SeedApprovedObjectiveAsync(db, tenantId, ownerEmployeeId, now);

        var handler = new GetObjectiveProgressQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = ownerEmployeeId },
            new StubAccessPolicy(canCorrectProgress: false),
            new StubHttpContextAccessor());

        var result = await handler.Handle(new GetObjectiveProgressQuery(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(0m, result.Value.EffectivePercent);
    }

    [Fact]
    public async Task GetProgress_AuthorizedManager_ReturnsObjectiveProgress()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var objective = await SeedApprovedObjectiveAsync(db, tenantId, ownerEmployeeId, now);

        var handler = new GetObjectiveProgressQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = managerEmployeeId },
            new StubAccessPolicy(canCorrectProgress: true),
            new StubHttpContextAccessor());

        var result = await handler.Handle(new GetObjectiveProgressQuery(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        Assert.Equal(objective.ProgressMode.ToString(), result.Value.Mode);
    }

    [Fact]
    public async Task GetProgress_NonOwnerWithoutPermission_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var viewerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var objective = await SeedApprovedObjectiveAsync(db, tenantId, ownerEmployeeId, now);

        var handler = new GetObjectiveProgressQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = viewerEmployeeId },
            new StubAccessPolicy(canCorrectProgress: false),
            new StubHttpContextAccessor());

        var result = await handler.Handle(new GetObjectiveProgressQuery(objective.Id), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotVisible", result.Error.Code);
    }

    [Fact]
    public async Task GetProgress_WithoutEmployeeContext_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;

        await using var db = PerformanceTestContext.Create(tenantId, out _);
        var objective = await SeedApprovedObjectiveAsync(db, tenantId, ownerEmployeeId, now);

        var handler = new GetObjectiveProgressQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = null },
            new StubAccessPolicy(canCorrectProgress: true),
            new StubHttpContextAccessor());

        var result = await handler.Handle(new GetObjectiveProgressQuery(objective.Id), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("EmployeeContextRequired", result.Error.Code);
    }

    private static async Task<PerformanceObjective> SeedApprovedObjectiveAsync(
        PerformanceDbContext db,
        Guid tenantId,
        Guid ownerEmployeeId,
        DateTime now)
    {
        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        var objective = PerformanceObjective.Create(
            tenantId,
            cycle.Id,
            ObjectiveLevel.Individual,
            ownerEmployeeId,
            "Improve onboarding",
            null,
            "Completion",
            "100%",
            now.AddDays(7),
            20);
        objective.Submit(now);
        objective.Approve(now);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();
        return objective;
    }
}
