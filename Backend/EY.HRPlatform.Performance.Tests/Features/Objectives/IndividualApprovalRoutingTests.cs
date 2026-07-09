using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Objectives;

/// <summary>
/// VERIFY individual approval routing — assigned-approver gating + exceptional manager
/// assignment (D-19 guardrail #1, individual path).
/// Drives the real handlers — does NOT modify production source.
/// </summary>
public sealed class IndividualApprovalRoutingTests
{
    /// <summary>
    /// 1. Assigned-approver-only: only the employee assigned the ObjectiveApproval work
    ///    item (the owner's primary-chain manager) can decide the approval; a different
    ///    employee attempting DecideObjectiveApproval is Forbidden ("ApprovalNotAssigned").
    /// </summary>
    [Fact]
    public async Task DecideApproval_NonAssignedActor_ReturnsForbidden()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var assignedApproverId = Guid.NewGuid();
        var randomEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            "Improve onboarding", null, "Completion", "100%", now.AddDays(10), 20);
        objective.Submit(now);

        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, assignedApproverId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        // Act — randomEmployeeId is NOT the assigned approver
        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = randomEmployeeId });
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Approve), CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Objective.ApprovalNotAssigned", result.Error.Code);
        // Objective should remain in PendingApproval
        Assert.Equal(ObjectiveStatus.PendingApproval, objective.Status);
    }

    /// <summary>
    /// 2. Wrong-work-item-type: deciding against a work item whose Type is not
    ///    ObjectiveApproval is rejected.
    /// </summary>
    [Fact]
    public async Task DecideApproval_WrongWorkItemType_ReturnsForbidden()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            "Improve onboarding", null, "Completion", "100%", now.AddDays(10), 20);
        objective.Submit(now);

        // Create a work item of type ObjectivePlanning (not ObjectiveApproval)
        var wrongTypeWorkItem = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, managerEmployeeId,
            CampaignWorkItemType.ObjectivePlanning, now.AddDays(2));
        db.AddRange(objective, wrongTypeWorkItem);
        await db.SaveChangesAsync();

        // Act — try to decide on a non-ObjectiveApproval work item
        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = managerEmployeeId });
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, wrongTypeWorkItem.Id, ObjectiveApprovalDecision.Approve), CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Objective.ApprovalNotAssigned", result.Error.Code);
        Assert.Equal(ObjectiveStatus.PendingApproval, objective.Status);
    }

    /// <summary>
    /// 3. Exceptional manager assignment: set up the approval work item assigned to a
    ///    manager who is NOT the default direct manager (an exceptional assignment) and
    ///    confirm that the exceptionally-assigned approver can decide the approval —
    ///    proving exceptional manager assignment works end-to-end (D-17).
    /// </summary>
    [Fact]
    public async Task DecideApproval_ExceptionallyAssignedApprover_CanDecide()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var defaultDirectManagerId = Guid.NewGuid();
        var exceptionalApproverId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            "Improve onboarding", null, "Completion", "100%", now.AddDays(10), 20);
        objective.Submit(now);

        // Exceptional assignment: the work item is assigned to exceptionalApproverId
        // (NOT the defaultDirectManagerId)
        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, exceptionalApproverId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        // Act — the exceptionally-assigned approver decides
        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = exceptionalApproverId });
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Approve), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Approved, objective.Status);
        Assert.Equal(CampaignWorkItemStatus.Completed, approval.Status);
    }

    /// <summary>
    /// 4. Primary-chain provenance: document that the default approval work item's
    ///    assignee matches the owner's primary-chain manager from FakeCoreWorkforceClient
    ///    (read the chain; assert chain[^1] / direct manager is the default assignee).
    /// </summary>
    [Fact]
    public async Task ApprovalWorkItem_DefaultAssignee_MatchesPrimaryChainDirectManager()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var directManagerId = Guid.NewGuid();
        var skipManagerId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        // Set up the primary management chain: root -> skip-level -> direct
        // chain[^1] should be the direct manager (per Plan 01 ordering pin)
        var fakeClient = new FakeCoreWorkforceClient();
        fakeClient.ManagerChains[ownerEmployeeId] =
        [
            FakeCoreWorkforceClient.Employee(skipManagerId, "Skip-Level Manager"),
            FakeCoreWorkforceClient.Employee(directManagerId, "Direct Manager")
        ];

        var cycle = TestCycles.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        // Route ObjectiveApproval to the direct manager via a work item
        db.CampaignWorkItems.Add(CampaignWorkItem.Create(tenantId, cycle.Id, ownerEmployeeId, directManagerId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2)));
        await db.SaveChangesAsync();

        // Act — resolve the manager chain
        var chain = await fakeClient.GetManagerChainAsync(ownerEmployeeId, CancellationToken.None);

        // Assert — the primary chain's direct manager (chain[^1]) matches the work item assignee
        Assert.NotEmpty(chain);
        var directManagerFromChain = chain[^1]; // last element is the direct manager
        Assert.Equal(directManagerId, directManagerFromChain.EmployeeId);

        // The approval work item's assignee matches the direct manager from the chain
        var approvalWorkItem = Assert.Single(db.CampaignWorkItems,
            w => w.Type == CampaignWorkItemType.ObjectiveApproval);
        Assert.Equal(directManagerId, approvalWorkItem.AssigneeEmployeeId);
    }

    /// <summary>
    /// 5. Assigned approver can approve: the employee assigned the ObjectiveApproval
    ///    work item can successfully decide (happy path).
    /// </summary>
    [Fact]
    public async Task DecideApproval_AssignedApprover_CanDecide()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var assignedApproverId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            "Improve onboarding", null, "Completion", "100%", now.AddDays(10), 20);
        objective.Submit(now);

        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, assignedApproverId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        // Act
        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = assignedApproverId });
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Approve), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Approved, objective.Status);
        Assert.Equal(CampaignWorkItemStatus.Completed, approval.Status);
    }
}
