using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Reviews.Commands;
using EY.HRPlatform.Performance.Features.Reviews.Queries;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Reviews;

public sealed class FormalReviewCommandHandlerTests
{
    [Fact]
    public async Task GetMyFormalReview_ReturnsFrozenDefinitionForAssignedTask()
    {
        var tenantId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Self);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, employeeId, employeeId, CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(1));
        db.AddRange(cycle, definition, task);
        await db.SaveChangesAsync();
        var handler = new GetMyFormalReviewQueryHandler(db, new StubCurrentUserContext { EmployeeId = employeeId });

        var result = await handler.Handle(new GetMyFormalReviewQuery(task.Id), default);

        Assert.True(result.IsSuccess);
        Assert.Equal("Self review", result.Value.DefinitionName);
        Assert.Single(result.Value.Criteria);
        Assert.Equal(FormalReviewKind.Self.ToString(), result.Value.Kind);
    }

    [Fact]
    public async Task ConfigureDefinition_InDraftReplacesOnlyTheSameReviewKind()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var cycle = TestCycles.Create(tenantId, "FY review", PerformanceCycleType.Annual, now, now.AddDays(10));
        db.PerformanceCycles.Add(cycle);
        await db.SaveChangesAsync();
        var handler = new ConfigureFormalReviewDefinitionCommandHandler(db, new StubCurrentUserContext());

        var result = await handler.Handle(new ConfigureFormalReviewDefinitionCommand(cycle.Id, FormalReviewKind.Self, "Self review",
            [new FormalReviewCriterionDefinitionInput("Impact", "Business impact", 1)], "Five point",
            [new FormalRatingScaleLevelDefinitionInput(1, "Needs improvement", null), new FormalRatingScaleLevelDefinitionInput(5, "Exceptional", null)]), default);

        Assert.True(result.IsSuccess);
        var definition = Assert.Single(db.FormalReviewDefinitionSnapshots);
        Assert.Equal(FormalReviewKind.Self, definition.Kind);
        Assert.Equal(2, definition.RatingScaleLevels.Count);
    }

    [Fact]
    public async Task SubmitReview_CreatesResponseOnlyForAssignedReviewerAndFrozenDefinition()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Self);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, subjectId, CampaignWorkItemType.SelfReview, DateTime.UtcNow.AddDays(1));
        db.AddRange(cycle, definition, task);
        await db.SaveChangesAsync();
        var handler = new SubmitFormalReviewCommandHandler(db, new StubCurrentUserContext { EmployeeId = subjectId });

        var result = await handler.Handle(new SubmitFormalReviewCommand(task.Id,
            [new FormalReviewCriterionResponseInput(definition.Criteria.Single().Id, 5, "Strong result")], "Self assessment", null), default);

        Assert.True(result.IsSuccess);
        var review = Assert.Single(db.PerformanceReviews);
        Assert.Equal(FormalReviewStatus.Submitted, review.Status);
        Assert.Equal(CampaignWorkItemStatus.Submitted, task.Status);
    }

    [Fact]
    public async Task FinalizeManagerReview_LocksAssessmentAndCompletesAssignedWork()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Manager);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, managerId, CampaignWorkItemType.ManagerReview, DateTime.UtcNow.AddDays(1));
        var review = PerformanceReview.Create(tenantId, cycle.Id, task.Id, subjectId, managerId, FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Strong impact")], "Assessment", null, DateTime.UtcNow);
        task.Submit(DateTime.UtcNow);
        db.AddRange(cycle, definition, task, review);
        await db.SaveChangesAsync();
        var handler = new FinalizeManagerReviewCommandHandler(db, new StubCurrentUserContext { EmployeeId = managerId });

        var result = await handler.Handle(new FinalizeManagerReviewCommand(review.Id), default);

        Assert.True(result.IsSuccess);
        Assert.True(review.IsLocked);
        Assert.Equal(CampaignWorkItemStatus.Completed, task.Status);
    }

    [Fact]
    public async Task RequestCorrection_CreatesOneSeparateTaskWithoutReopeningFinalOutcome()
    {
        var tenantId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var cycle = NewActiveCycle(tenantId);
        var definition = NewDefinition(tenantId, cycle.Id, FormalReviewKind.Manager);
        var task = CampaignWorkItem.Create(tenantId, cycle.Id, subjectId, managerId, CampaignWorkItemType.ManagerReview, DateTime.UtcNow.AddDays(1));
        var review = PerformanceReview.Create(tenantId, cycle.Id, task.Id, subjectId, managerId, FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Strong impact")], "Assessment", null, DateTime.UtcNow);
        review.FinalizeOutcome(DateTime.UtcNow);
        db.AddRange(cycle, definition, task, review);
        await db.SaveChangesAsync();
        var handler = new RequestFormalReviewCorrectionCommandHandler(db, new StubCurrentUserContext { EmployeeId = managerId });

        var result = await handler.Handle(new RequestFormalReviewCorrectionCommand(review.Id, "Evidence was incomplete", DateTime.UtcNow.AddDays(2)), default);

        Assert.True(result.IsSuccess);
        Assert.True(review.IsLocked);
        Assert.Single(db.CampaignWorkItems.Where(item => item.Type == CampaignWorkItemType.Correction));
    }

    private static PerformanceCycle NewActiveCycle(Guid tenantId)
    {
        var now = DateTime.UtcNow;
        var cycle = TestCycles.Create(tenantId, "FY review", PerformanceCycleType.Annual, now.AddDays(-2), now.AddDays(10));
        cycle.ConfigureGovernance(Guid.NewGuid(), false, 3, CampaignFeedbackVisibility.AnonymousToSubject, [Guid.NewGuid()]);
        cycle.BeginAssignmentPreparation(1, now.AddDays(-1));
        cycle.MarkReadyToLaunch(1, 0, true, now.AddHours(-12));
        cycle.Activate(now);
        return cycle;
    }

    private static FormalReviewDefinitionSnapshot NewDefinition(Guid tenantId, Guid cycleId, FormalReviewKind kind)
        => FormalReviewDefinitionSnapshot.Create(tenantId, cycleId, kind, $"{kind} review",
            [new ReviewCriterionDefinition("Impact", "Business impact", 1)], "Five point",
            [new RatingScaleLevelDefinition(1, "Needs improvement"), new RatingScaleLevelDefinition(5, "Exceptional")], DateTime.UtcNow);
}
