using System.Security.Claims;
using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.CollectiveObjectives.Commands;
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
        var cycle = PerformanceCycle.Create(
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
        => new(dbContext, workforceClient,
            new StubCurrentUserContext
            {
                UserId = Guid.NewGuid(),
                EmployeeId = Guid.NewGuid(),
                FullName = "Test Approver",
                CorrelationId = "test-corr-123"
            });

    [Fact]
    public async Task Handle_FrozenRuleFalse_AutoApprovesAndEmitsAudit()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = CreateCycle(_tenantId, requireApproval: false);
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = CreateHandler(db, new FakeCoreWorkforceClient());

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var obj = await db.PerformanceObjectives.FindAsync(objective.Id);
        Assert.Equal(ObjectiveStatus.Approved, obj!.Status);

        // No work item created
        Assert.Null(db.CampaignWorkItems.FirstOrDefault(w => w.Type == CampaignWorkItemType.TeamObjectiveApproval));

        // Audit event emitted
        var audit = db.PerformanceCycleAuditEvents.FirstOrDefault(a => a.Action == PerformanceCycleAuditAction.CollectiveObjectiveAutoApproved);
        Assert.NotNull(audit);
        Assert.Equal("Success", audit!.Outcome);
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
    public async Task Handle_NoEligibleSuperior_HandsOffToExceptionOwner()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = CreateCycle(_tenantId, requireApproval: true);
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        // Query the exception owner that was added via ConfigureGovernance
        var existingOwner = db.CampaignExceptionOwners.FirstOrDefault(eo => eo.CycleId == cycle.Id);
        Assert.NotNull(existingOwner);

        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.ManagerChains[_ownerEmployeeId] = [];

        var handler = CreateHandler(db, fakeClient);

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);

        var workItem = db.CampaignWorkItems.FirstOrDefault(w => w.Type == CampaignWorkItemType.TeamObjectiveApproval);
        Assert.NotNull(workItem);
        Assert.Equal(existingOwner!.EmployeeId, workItem!.AssigneeEmployeeId);

        var audit = db.PerformanceCycleAuditEvents.FirstOrDefault(a => a.Action == PerformanceCycleAuditAction.CollectiveObjectiveApprovalRouted);
        Assert.NotNull(audit);
        Assert.Contains("exception", audit!.Details!, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public async Task Handle_EveryRoutePathEmitsAuditEvent()
    {
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = CreateCycle(_tenantId, requireApproval: false);
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = CreateHandler(db, new FakeCoreWorkforceClient());

        await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        var auditCount = await db.PerformanceCycleAuditEvents.CountAsync();
        Assert.Equal(1, auditCount);
    }

    [Fact]
    public async Task Handle_FrozenTrueLiveFalse_UsesFrozenValue()
    {
        // Frozen=null (cycle never went through preparation) treated as false → auto-approve
        var db = CreateContext($"test-{Guid.NewGuid()}", _tenantId);
        var cycle = PerformanceCycle.Create(
            _tenantId, "Test Cycle", PerformanceCycleType.Annual,
            DateTime.UtcNow.AddDays(-30), DateTime.UtcNow.AddDays(30));
        db.PerformanceCycles.Add(cycle);

        var objective = CreateObjective(_tenantId, cycle.Id, _ownerEmployeeId);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = CreateHandler(db, new FakeCoreWorkforceClient());

        var result = await handler.Handle(new RouteCollectiveApprovalCommand(objective.Id), CancellationToken.None);

        Assert.True(result.IsSuccess);
        var obj = await db.PerformanceObjectives.FindAsync(objective.Id);
        Assert.Equal(ObjectiveStatus.Approved, obj!.Status);
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
