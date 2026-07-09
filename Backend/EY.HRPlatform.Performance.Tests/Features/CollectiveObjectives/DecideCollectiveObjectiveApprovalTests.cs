using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.Performance.Tests.Features.CollectiveObjectives;

public sealed class DecideCollectiveObjectiveApprovalTests
{
    private readonly Guid _tenantId = Guid.NewGuid();

    private PerformanceDbContext CreateContext(string dbName)
    {
        var tc = new TenantContext();
        tc.SetTenant(_tenantId);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new PerformanceDbContext(options, tc);
    }

    private static ClaimsPrincipal BuildUserWithPermission(Guid employeeId, params string[] permissions)
    {
        var builder = new ClaimsPrincipalBuilder()
            .WithEmployeeId(employeeId);
        foreach (var perm in permissions)
            builder.WithPermission(perm, PermissionScopes.Tenant);
        return builder.Build();
    }

    private DecideCollectiveObjectiveApprovalCommandHandler CreateHandler(
        PerformanceDbContext dbContext,
        ClaimsPrincipal user)
    {
        var httpContext = new DefaultHttpContext { User = user };
        return new DecideCollectiveObjectiveApprovalCommandHandler(
            dbContext,
            new StubCurrentUserContext { EmployeeId = user.GetEmployeeId(), FullName = "Approver" },
            new PerformanceAccessPolicyService(),
            new HttpContextAccessor { HttpContext = httpContext });
    }

    [Fact]
    public async Task Handle_Approve_CollectiveObjectiveApproved()
    {
        var approverId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();

        var db = CreateContext($"test-{Guid.NewGuid()}");

        var cycle = TestCycles.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            ownerEmployeeId, "Goal", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m);
        obj.Submit(DateTime.UtcNow); // Draft → PendingApproval
        db.PerformanceObjectives.Add(obj);

        var workItem = CampaignWorkItem.Create(_tenantId, cycle.Id, ownerEmployeeId, approverId,
            CampaignWorkItemType.TeamObjectiveApproval, DateTime.UtcNow.AddDays(20));
        db.CampaignWorkItems.Add(workItem);
        await db.SaveChangesAsync();

        var user = BuildUserWithPermission(approverId, PerformancePermissions.ObjectiveTeamApprove);
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(
            new DecideCollectiveObjectiveApprovalCommand(obj.Id, workItem.Id, ObjectiveApprovalDecision.Approve),
            CancellationToken.None);

        Assert.True(result.IsSuccess);
        var updatedObj = await db.PerformanceObjectives.FindAsync(obj.Id);
        Assert.Equal(ObjectiveStatus.Approved, updatedObj!.Status);
    }

    [Fact]
    public async Task Handle_NotAssignedApprover_ReturnsForbidden()
    {
        var approverId = Guid.NewGuid();
        var wrongApproverId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();

        var db = CreateContext($"test-{Guid.NewGuid()}");

        var cycle = TestCycles.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            ownerEmployeeId, "Goal", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m);
        db.PerformanceObjectives.Add(obj);

        var workItem = CampaignWorkItem.Create(_tenantId, cycle.Id, ownerEmployeeId, approverId,
            CampaignWorkItemType.TeamObjectiveApproval, DateTime.UtcNow.AddDays(20));
        db.CampaignWorkItems.Add(workItem);
        await db.SaveChangesAsync();

        // Wrong approver tries to approve
        var user = BuildUserWithPermission(wrongApproverId, PerformancePermissions.ObjectiveTeamApprove);
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(
            new DecideCollectiveObjectiveApprovalCommand(obj.Id, workItem.Id, ObjectiveApprovalDecision.Approve),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("ApprovalNotAssigned", result.Error.Code);
    }

    [Fact]
    public async Task Handle_WrongWorkItemType_ReturnsForbidden()
    {
        var approverId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();

        var db = CreateContext($"test-{Guid.NewGuid()}");

        var cycle = TestCycles.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            ownerEmployeeId, "Goal", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m);
        db.PerformanceObjectives.Add(obj);

        // Wrong type: ObjectiveApproval instead of TeamObjectiveApproval
        var workItem = CampaignWorkItem.Create(_tenantId, cycle.Id, ownerEmployeeId, approverId,
            CampaignWorkItemType.ObjectiveApproval, DateTime.UtcNow.AddDays(20));
        db.CampaignWorkItems.Add(workItem);
        await db.SaveChangesAsync();

        var user = BuildUserWithPermission(approverId, PerformancePermissions.ObjectiveTeamApprove);
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(
            new DecideCollectiveObjectiveApprovalCommand(obj.Id, workItem.Id, ObjectiveApprovalDecision.Approve),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("ApprovalNotAssigned", result.Error.Code);
    }

    [Fact]
    public async Task Handle_NoPermission_ReturnsForbidden()
    {
        var approverId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();

        var db = CreateContext($"test-{Guid.NewGuid()}");

        var cycle = TestCycles.Create(_tenantId, "Test", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var obj = PerformanceObjective.Create(_tenantId, cycle.Id, ObjectiveLevel.Team,
            ownerEmployeeId, "Goal", null, "Measure", "Target",
            DateTime.UtcNow.AddDays(20), 50m);
        db.PerformanceObjectives.Add(obj);

        var workItem = CampaignWorkItem.Create(_tenantId, cycle.Id, ownerEmployeeId, approverId,
            CampaignWorkItemType.TeamObjectiveApproval, DateTime.UtcNow.AddDays(20));
        db.CampaignWorkItems.Add(workItem);
        await db.SaveChangesAsync();

        var user = new ClaimsPrincipalBuilder().WithEmployeeId(approverId).Build(); // no permissions
        var handler = CreateHandler(db, user);

        var result = await handler.Handle(
            new DecideCollectiveObjectiveApprovalCommand(obj.Id, workItem.Id, ObjectiveApprovalDecision.Approve),
            CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("ApprovalForbidden", result.Error.Code);
    }
}

internal static class ClaimsPrincipalExtensions
{
    internal static Guid? GetEmployeeId(this ClaimsPrincipal user)
    {
        var claim = user.FindFirst(EY.HRPlatform.SharedKernel.Auth.CustomClaimTypes.EmployeeId);
        return claim != null && Guid.TryParse(claim.Value, out var id) ? id : null;
    }
}
