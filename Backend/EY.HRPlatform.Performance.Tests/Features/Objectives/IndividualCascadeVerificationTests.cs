using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Objectives.Commands;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Objectives;

/// <summary>
/// VERIFY the existing individual objective cascade against the spec and D-17.
/// Covers: create (catalog + ad-hoc), submit, approve, return + re-submit, reject.
/// Drives the real handlers — does NOT modify production code.
/// </summary>
public sealed class IndividualCascadeVerificationTests
{
    private const string CatalogTemplateTitle = "Improve Customer Satisfaction";
    private const string CatalogTemplateMeasure = "CSAT Score";
    private const string CatalogTemplateTarget = "90%";
    private const string AdHocTitle = "Ad Hoc Process Improvement";
    private const string AdHocMeasure = "Process Efficiency";
    private const string AdHocTarget = "15% improvement";

    /// <summary>
    /// 1. Create from catalog template: a planning-assigned employee creates an
    ///    Individual objective referencing an ObjectiveTemplate, in Draft.
    /// </summary>
    [Fact]
    public async Task Create_FromCatalogTemplate_CreatesDraftIndividualObjective()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        // Create an ObjectiveTemplate (catalog source) using the stable-identity model
        var template = ObjectiveTemplate.Create(tenantId);
        var templateRevision = template.CreateDraftRevision(
            CatalogTemplateTitle, "Catalog template for customer satisfaction", null,
            "Qualitative", null, null, null, null, CatalogTemplateMeasure,
            tenantId.ToString(), null);
        templateRevision.SetApplicabilityValidationState("Valid");
        template.ActivateRevision(tenantId.ToString(), null, null);
        db.ObjectiveTemplateContainers.Add(template);

        db.CampaignWorkItems.Add(CampaignWorkItem.Create(tenantId, cycle.Id, employeeId, employeeId,
            CampaignWorkItemType.ObjectivePlanning, now.AddDays(10)));
        await db.SaveChangesAsync();

        var handler = new CreateObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });

        // Act — create objective from catalog template (ParentObjectiveId = template.Id)
        var result = await handler.Handle(new CreateObjectiveCommand(
            cycle.Id, CatalogTemplateTitle, null, CatalogTemplateMeasure, CatalogTemplateTarget,
            now.AddDays(7), 20, template.Id), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        var objective = Assert.Single(db.PerformanceObjectives);
        Assert.Equal(employeeId, objective.OwnerEmployeeId);
        Assert.Equal(ObjectiveStatus.Draft, objective.Status);
        Assert.Equal(template.Id, objective.ParentObjectiveId);
        Assert.Equal(ObjectiveLevel.Individual, objective.Level);
        Assert.Equal(tenantId, objective.TenantId);
    }

    /// <summary>
    /// 2. Create ad hoc (no template): the same create command without a template
    ///    still produces a Draft individual objective — confirming the ad-hoc path (D-08).
    /// </summary>
    [Fact]
    public async Task Create_AdHoc_CreatesDraftIndividualObjectiveWithoutTemplate()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var cycle = PerformanceCycle.Create(tenantId, "FY26", PerformanceCycleType.Annual, now.AddDays(-1), now.AddDays(30));
        cycle.ConfigureForAssignmentPreparation();
        cycle.BeginAssignmentPreparation(1, now);
        cycle.MarkReadyToLaunch(1, 0, true, now);
        cycle.Activate(now);
        db.PerformanceCycles.Add(cycle);

        db.CampaignWorkItems.Add(CampaignWorkItem.Create(tenantId, cycle.Id, employeeId, employeeId,
            CampaignWorkItemType.ObjectivePlanning, now.AddDays(10)));
        await db.SaveChangesAsync();

        var handler = new CreateObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });

        // Act — create ad hoc (no template, ParentObjectiveId = null)
        var result = await handler.Handle(new CreateObjectiveCommand(
            cycle.Id, AdHocTitle, "Self-initiated improvement", AdHocMeasure, AdHocTarget,
            now.AddDays(7), 15, null), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        var objective = Assert.Single(db.PerformanceObjectives);
        Assert.Equal(employeeId, objective.OwnerEmployeeId);
        Assert.Equal(ObjectiveStatus.Draft, objective.Status);
        Assert.Null(objective.ParentObjectiveId);
        Assert.Equal(ObjectiveLevel.Individual, objective.Level);
    }

    /// <summary>
    /// 3a. Submit: the owner submits a Draft -> PendingApproval.
    /// </summary>
    [Fact]
    public async Task Submit_OwnerSubmitsDraft_Succeeds()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            AdHocTitle, null, AdHocMeasure, AdHocTarget, now.AddDays(10), 15);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new SubmitObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });

        // Act
        var result = await handler.Handle(new SubmitObjectiveCommand(objective.Id), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.PendingApproval, objective.Status);
        Assert.NotNull(objective.SubmittedAt);
    }

    /// <summary>
    /// 3b. Submit denied: a non-owner attempting to submit another employee's objective
    ///    gets Forbidden.
    /// </summary>
    [Fact]
    public async Task Submit_NonOwnerSubmits_ReturnsForbidden()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var nonOwnerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            AdHocTitle, null, AdHocMeasure, AdHocTarget, now.AddDays(10), 15);
        db.PerformanceObjectives.Add(objective);
        await db.SaveChangesAsync();

        var handler = new SubmitObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = nonOwnerEmployeeId });

        // Act
        var result = await handler.Handle(new SubmitObjectiveCommand(objective.Id), CancellationToken.None);

        // Assert
        Assert.True(result.IsFailure);
        Assert.Equal("Objective.NotOwner", result.Error.Code);
    }

    /// <summary>
    /// 4. Approve: the assigned approver decides Approve via the ObjectiveApproval
    ///    work item -> Status Approved.
    /// </summary>
    [Fact]
    public async Task Approve_AssignedApproverApproves_SetsApproved()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            AdHocTitle, null, AdHocMeasure, AdHocTarget, now.AddDays(10), 15);
        objective.Submit(now);

        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, managerEmployeeId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = managerEmployeeId });

        // Act
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Approve), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Approved, objective.Status);
        Assert.NotNull(objective.ApprovedAt);
        Assert.Equal(CampaignWorkItemStatus.Completed, approval.Status);
    }

    /// <summary>
    /// 5a. Return: the assigned approver decides Return -> Status Returned.
    /// </summary>
    [Fact]
    public async Task Return_AssignedApproverReturns_SetsReturned()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            AdHocTitle, null, AdHocMeasure, AdHocTarget, now.AddDays(10), 15);
        objective.Submit(now);

        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, managerEmployeeId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = managerEmployeeId });

        // Act
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Return), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Returned, objective.Status);
        Assert.Equal(CampaignWorkItemStatus.Completed, approval.Status);
    }

    /// <summary>
    /// 5b. Re-submit after return: the owner can re-submit a Returned objective
    ///    (Submit allows Draft OR Returned per the domain guard).
    /// </summary>
    [Fact]
    public async Task Resubmit_AfterReturn_SubmitsSuccessfully()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            AdHocTitle, null, AdHocMeasure, AdHocTarget, now.AddDays(10), 15);
        objective.Submit(now);
        objective.Return(now); // Return the objective

        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, managerEmployeeId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        approval.Submit(now);
        approval.Complete(now);
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        var submitHandler = new SubmitObjectiveCommandHandler(db, new StubCurrentUserContext { EmployeeId = ownerEmployeeId });

        // Act — re-submit a Returned objective
        var result = await submitHandler.Handle(new SubmitObjectiveCommand(objective.Id), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.PendingApproval, objective.Status);
    }

    /// <summary>
    /// 6. Reject: the assigned approver decides Reject -> Status Rejected.
    /// </summary>
    [Fact]
    public async Task Reject_AssignedApproverRejects_SetsRejected()
    {
        // Arrange
        var tenantId = Guid.NewGuid();
        var ownerEmployeeId = Guid.NewGuid();
        var managerEmployeeId = Guid.NewGuid();
        var now = DateTime.UtcNow;
        await using var db = PerformanceTestContext.Create(tenantId, out _);

        var objective = PerformanceObjective.Create(
            tenantId, Guid.NewGuid(), ObjectiveLevel.Individual, ownerEmployeeId,
            AdHocTitle, null, AdHocMeasure, AdHocTarget, now.AddDays(10), 15);
        objective.Submit(now);

        var approval = CampaignWorkItem.Create(tenantId, objective.CycleId, ownerEmployeeId, managerEmployeeId,
            CampaignWorkItemType.ObjectiveApproval, now.AddDays(2));
        db.AddRange(objective, approval);
        await db.SaveChangesAsync();

        var handler = new DecideObjectiveApprovalCommandHandler(db, new StubCurrentUserContext { EmployeeId = managerEmployeeId });

        // Act
        var result = await handler.Handle(new DecideObjectiveApprovalCommand(
            objective.Id, approval.Id, ObjectiveApprovalDecision.Reject), CancellationToken.None);

        // Assert
        Assert.True(result.IsSuccess);
        Assert.Equal(ObjectiveStatus.Rejected, objective.Status);
        Assert.Equal(CampaignWorkItemStatus.Completed, approval.Status);
    }
}
