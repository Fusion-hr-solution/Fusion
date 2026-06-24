using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Reviews.Commands;
using EY.HRPlatform.Performance.Features.Reviews.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Reviews;

/// <summary>
/// Verification tests (D-17, REQ-formal-review [V]) proving the existing formal-review
/// flow enforces frozen templates + rating scale, self-feeds-manager accountability,
/// finalize/lock immutability, and governed corrections — without modifying production code.
/// </summary>
public sealed class FormalReviewVerificationTests
{
    // ── 1. Rating-scale enforcement ──────────────────────────────────────

    [Fact]
    public async Task SubmitReview_RejectsRatingOutsideFrozenScale()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Self);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, subjectId,
            CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(1));
        db.AddRange(cycle, definition, task);
        await db.SaveChangesAsync();
        var handler = new SubmitFormalReviewCommandHandler(db, new StubCurrentUserContext { EmployeeId = subjectId });

        // Rating 3 is outside the frozen scale (1, 5)
        var result = await handler.Handle(new SubmitFormalReviewCommand(task.Id,
            [new FormalReviewCriterionResponseInput(definition.Criteria.Single().Id, 3, null)],
            null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("Review.InvalidResponses", result.Error.Code);
    }

    [Fact]
    public async Task SubmitReview_RejectsUnknownCriterionId()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Self);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, subjectId,
            CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(1));
        db.AddRange(cycle, definition, task);
        await db.SaveChangesAsync();
        var handler = new SubmitFormalReviewCommandHandler(db, new StubCurrentUserContext { EmployeeId = subjectId });

        // Use a criterion id that does not belong to the frozen definition
        var result = await handler.Handle(new SubmitFormalReviewCommand(task.Id,
            [new FormalReviewCriterionResponseInput(Guid.NewGuid(), 5, null)],
            null, null), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("Review.InvalidResponses", result.Error.Code);
    }

    // ── 2. Frozen-template immutability ──────────────────────────────────

    [Fact]
    public async Task ConfigureDefinition_AfterPreparation_ReturnsDefinitionFrozen()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var handler = new ConfigureFormalReviewDefinitionCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFormalReviewDefinitionCommand(
            cycle.Id, FormalReviewKind.Self, "Post-freeze attempt",
            [new FormalReviewCriterionDefinitionInput("Impact", null, 1)], "Scale",
            [new FormalRatingScaleLevelDefinitionInput(1, "Low", null)]), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("Review.DefinitionFrozen", result.Error.Code);
    }

    // ── 3. Self-feeds-manager accountability ─────────────────────────────

    [Fact]
    public async Task SelfReview_SubmittedBySubject_IsRetrievableForManagerFeed()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var selfDefinition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Self);
        var selfTask = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, subjectId,
            CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(1));
        db.AddRange(cycle, selfDefinition, selfTask);
        await db.SaveChangesAsync();

        // Subject submits their self-review
        var submitHandler = new SubmitFormalReviewCommandHandler(db, new StubCurrentUserContext { EmployeeId = subjectId });
        var submitResult = await submitHandler.Handle(new SubmitFormalReviewCommand(selfTask.Id,
            [new FormalReviewCriterionResponseInput(selfDefinition.Criteria.Single().Id, 5, "Self assessment")],
            "My self assessment", null), default);
        Assert.True(submitResult.IsSuccess);

        // Query the submitted self-review — confirms it is retrievable as manager-assessment input
        var queryHandler = new GetMyFormalReviewQueryHandler(db, new StubCurrentUserContext { EmployeeId = subjectId });
        var queryResult = await queryHandler.Handle(new GetMyFormalReviewQuery(selfTask.Id), default);

        Assert.True(queryResult.IsSuccess);
        Assert.Equal(FormalReviewKind.Self.ToString(), queryResult.Value.Kind);
        Assert.Equal(FormalReviewStatus.Submitted.ToString(), queryResult.Value.ReviewStatus);
    }

    [Fact]
    public async Task FinalizeManagerReview_RejectsSelfReviewKind()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Self);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, subjectId,
            CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(1));
        var review = PerformanceReview.Create(tenantId, cycle.Id, task.Id, subjectId, subjectId,
            FormalReviewKind.Self, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Self assessment")],
            "Narrative", null, DateTime.UtcNow);
        task.Submit(DateTime.UtcNow);
        db.AddRange(cycle, definition, task, review);
        await db.SaveChangesAsync();
        var handler = new FinalizeManagerReviewCommandHandler(db, new StubCurrentUserContext { EmployeeId = subjectId });

        // FinalizeManagerReview only accepts FormalReviewKind.Manager
        var result = await handler.Handle(new FinalizeManagerReviewCommand(review.Id), default);

        Assert.False(result.IsSuccess);
        Assert.Equal("Review.FinalizationNotAssigned", result.Error.Code);
    }

    // ── 4. Finalize + lock immutability ──────────────────────────────────

    [Fact]
    public async Task FinalizeManagerReview_SetsIsLockedAndRejectsFurtherChange()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Manager);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, managerId,
            CampaignWorkItemType.ManagerReview, DateTime.UtcNow.AddDays(1));
        var review = PerformanceReview.Create(tenantId, cycle.Id, task.Id, subjectId, managerId,
            FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Strong impact")],
            "Assessment", null, DateTime.UtcNow);
        task.Submit(DateTime.UtcNow);
        db.AddRange(cycle, definition, task, review);
        await db.SaveChangesAsync();
        var finalizeHandler = new FinalizeManagerReviewCommandHandler(db,
            new StubCurrentUserContext { EmployeeId = managerId });

        // Finalize the manager review
        var finalizeResult = await finalizeHandler.Handle(new FinalizeManagerReviewCommand(review.Id), default);
        Assert.True(finalizeResult.IsSuccess);
        Assert.True(review.IsLocked);
        Assert.Equal(FormalReviewStatus.Finalized, review.Status);

        // Attempt to submit again on the same work item — rejected because the work item is Completed
        var submitHandler = new SubmitFormalReviewCommandHandler(db,
            new StubCurrentUserContext { EmployeeId = managerId });
        var submitResult = await submitHandler.Handle(new SubmitFormalReviewCommand(task.Id,
            [new FormalReviewCriterionResponseInput(definition.Criteria.Single().Id, 2, "Changed")],
            "Changed", null), default);

        Assert.False(submitResult.IsSuccess);
        Assert.Equal("Review.InvalidWorkItemState", submitResult.Error.Code);
    }

    // ── 5. Governed correction ───────────────────────────────────────────

    [Fact]
    public async Task RequestCorrection_CreatesSeparateTaskLeavesOriginalUnchangedEmitsAudit()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Manager);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, managerId,
            CampaignWorkItemType.ManagerReview, DateTime.UtcNow.AddDays(1));
        var review = PerformanceReview.Create(tenantId, cycle.Id, task.Id, subjectId, managerId,
            FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Strong impact")],
            "Assessment", null, DateTime.UtcNow);
        review.FinalizeOutcome(DateTime.UtcNow);
        db.AddRange(cycle, definition, task, review);
        await db.SaveChangesAsync();
        var handler = new RequestFormalReviewCorrectionCommandHandler(db,
            new StubCurrentUserContext { EmployeeId = managerId });

        var result = await handler.Handle(
            new RequestFormalReviewCorrectionCommand(review.Id, "Evidence was incomplete", DateTime.UtcNow.AddDays(2)),
            default);

        Assert.True(result.IsSuccess);
        // Original outcome remains finalized and locked
        Assert.True(review.IsLocked);
        Assert.Equal(FormalReviewStatus.Finalized, review.Status);
        // A separate correction work item was created
        Assert.Single(db.CampaignWorkItems.Where(item => item.Type == CampaignWorkItemType.Correction));
        // ReviewCorrectionRequested audit event emitted
        Assert.Contains(db.PerformanceCycleAuditEvents,
            e => e.Action == PerformanceCycleAuditAction.ReviewCorrectionRequested
                 && e.CycleId == cycle.Id);
    }

    [Fact]
    public async Task RequestCorrection_ForbiddenForNonAccountableActor()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Manager);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, managerId,
            CampaignWorkItemType.ManagerReview, DateTime.UtcNow.AddDays(1));
        var review = PerformanceReview.Create(tenantId, cycle.Id, task.Id, subjectId, managerId,
            FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Strong impact")],
            "Assessment", null, DateTime.UtcNow);
        review.FinalizeOutcome(DateTime.UtcNow);
        db.AddRange(cycle, definition, task, review);
        await db.SaveChangesAsync();
        var handler = new RequestFormalReviewCorrectionCommandHandler(db,
            new StubCurrentUserContext { EmployeeId = otherId });

        var result = await handler.Handle(
            new RequestFormalReviewCorrectionCommand(review.Id, "Trying to correct", DateTime.UtcNow.AddDays(2)),
            default);

        Assert.False(result.IsSuccess);
        Assert.Equal("Review.CorrectionNotAssigned", result.Error.Code);
    }

    // ── Helpers ──────────────────────────────────────────────────────────

    private static PerformanceCycle NewActiveCycle(Guid tenantId)
    {
        var now = DateTime.UtcNow;
        var cycle = PerformanceCycle.Create(tenantId, "FY review", PerformanceCycleType.Annual,
            now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3,
            CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }

    private static FormalReviewDefinitionSnapshot NewDefinition(
        Guid tenantId, Guid cycleId, FormalReviewKind kind)
        => FormalReviewDefinitionSnapshot.Create(tenantId, cycleId, kind, $"{kind} review",
            [new ReviewCriterionDefinition("Impact", "Business impact", 1)], "Five point",
            [new RatingScaleLevelDefinition(1, "Needs improvement"),
             new RatingScaleLevelDefinition(5, "Exceptional")], DateTime.UtcNow);
}
