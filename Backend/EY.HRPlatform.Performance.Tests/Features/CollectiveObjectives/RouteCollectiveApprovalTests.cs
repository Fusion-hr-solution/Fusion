using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;
using EY.HRPlatform.Performance.Features.Exceptions.Services;
using EY.HRPlatform.Performance.Features.Security;
using EY.HRPlatform.Performance.Infrastructure.Persistence;
using EY.HRPlatform.Performance.Infrastructure.Workforce;
using EY.HRPlatform.Performance.Tests.TestSupport;
using EY.HRPlatform.SharedKernel.Auth;
using EY.HRPlatform.SharedKernel.Multitenancy;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace EY.HRPlatform.Performance.Tests.Features.CollectiveObjectives;

public sealed class RouteCollectiveApprovalTests
{
    private readonly Guid _tenantId = Guid.NewGuid();
    private readonly Guid _ownerEmployeeId = Guid.NewGuid();

    private PerformanceDbContext CreateContext(string dbName, Guid tenantId)
    {
        var tc = new TenantContext();
        tc.SetTenant(tenantId);
        var options = new DbContextOptionsBuilder<PerformanceDbContext>()
            .UseInMemoryDatabase(dbName)
            .Options;
        return new PerformanceDbContext(options, tc);
    }

    private PerformanceCycle CreateCycle(Guid tenantId, bool requireApproval)
    {
        var exceptionOwnerId = Guid.NewGuid();
        var cycle = TestCycles.Create(
            tenantId, "Test Cycle", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));

        cycle.ConfigureGovernance(
            Guid.NewGuid(), requireApproval, 3,
            CampaignFeedbackVisibility.AnonymousToSubject,
            [exceptionOwnerId]);

        cycle.BeginAssignmentPreparation(1, DateTime.UtcNow);
        cycle.MarkReadyToLaunch(finalResponsibilityCount: 1, readinessFailureCount: 0,
            hasAcceptedWorkforceDelta: true, DateTime.UtcNow);
        cycle.Activate(DateTime.UtcNow);

        return cycle;
    }

    private static PerformanceObjective CreateObjective(Guid tenantId, Guid cycleId, Guid ownerEmployeeId)
        => PerformanceObjective.Create(
            tenantId, cycleId, ObjectiveLevel.Team, ownerEmployeeId,
            "Test Collective Objective", "Description",
            "Measurable outcome", "Target value",
            DateTime.UtcNow.AddDays(20), 50m);

    private static RouteCollectiveApprovalCommandHandler CreateHandler(
        PerformanceDbContext dbContext, ICoreWorkforceClient workforceClient)
    {
        var currentUser = new StubCurrentUserContext
        {
            UserId = Guid.NewGuid(),
            EmployeeId = Guid.NewGuid(),
            FullName = "Test Approver",
            CorrelationId = "test-corr-123"
        };
        return new RouteCollectiveApprovalCommandHandler(
            dbContext,
            workforceClient,
            new ExceptionCaseWorkflowService(dbContext, currentUser),
            currentUser);
    }

    [Fact]
    public async Task Handle_FrozenRuleTrueAndValidPrimaryChain_CreatesWorkItemForApprover()
    {
        var managerId = Guid.NewGuid();
        var chain = new List<CoreEmployeeSummary>
        {
            FakeCoreWorkforceClient.Employee(managerId, "Manager Smith"),
        };

        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = CreateCycle(_tenantId, requireApproval: true);
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.ManagerChains[_ownerEmployeeId] = chain;

        var handler = CreateHandler(db, fakeClient);

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var workItem = db.CampaignWorkItems.FirstOrDefault(w => w.Type == CampaignWorkItemType.TeamObjectiveApproval);
        Assert.NotNull(workItem);
        Assert.Equal(managerId, workItem!.AssigneeEmployeeId);
        Assert.Equal(_ownerEmployeeId, workItem.SubjectEmployeeId);

        var audit = db.PerformanceCycleAuditEvents.FirstOrDefault(a => a.Action == PerformanceCycleAuditAction.CollectiveObjectiveApprovalRouted);
        Assert.NotNull(audit);
        Assert.Contains("primary", audit!.Details!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_ActiveDelegateRedirectsToDelegate()
    {
        var managerId = Guid.NewGuid();
        var delegateId = Guid.NewGuid();
        var chain = new List<CoreEmployeeSummary>
        {
            FakeCoreWorkforceClient.Employee(managerId, "Manager Smith"),
        };

        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = CreateCycle(_tenantId, requireApproval: true);
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);

        var approvalDelegate = ApprovalDelegate.Create(
            _tenantId, cycle.Id, managerId, delegateId,
            DateTime.UtcNow.AddDays(-1), DateTime.UtcNow.AddDays(30));
        db.ApprovalDelegates.Add(approvalDelegate);
        await db.SaveChangesAsync();

        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.ManagerChains[_ownerEmployeeId] = chain;

        var handler = CreateHandler(db, fakeClient);

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var workItem = db.CampaignWorkItems.FirstOrDefault(w => w.Type == CampaignWorkItemType.TeamObjectiveApproval);
        Assert.NotNull(workItem);
        Assert.Equal(delegateId, workItem!.AssigneeEmployeeId);

        var audit = db.PerformanceCycleAuditEvents.FirstOrDefault(a => a.Action == PerformanceCycleAuditAction.CollectiveObjectiveApprovalRouted);
        Assert.NotNull(audit);
        Assert.Contains("delegate", audit!.Details!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_NoEligibleSuperior_FailsWithoutRouting()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = CreateCycle(_tenantId, requireApproval: true);
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.ManagerChains[_ownerEmployeeId] = [];

        var handler = CreateHandler(db, fakeClient);

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        // Exception-owner escalation was removed with the governed launch path; with no eligible
        // superior or delegate, routing fails without creating a work item.
        Assert.True(result.IsFailure);
        Assert.Null(db.CampaignWorkItems.FirstOrDefault(w => w.Type == CampaignWorkItemType.TeamObjectiveApproval));
    }

    [Fact]
    public async Task Handle_ObjectiveNotFound_ReturnsNotFound()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var handler = CreateHandler(db, new FakeCoreWorkforceClient());

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(Guid.NewGuid()), CancellationToken.None);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code, StringComparison.OrdinalIgnoreCase);
    }
}
