using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Exceptions;

namespace EY.HRPlatform.Performance.Tests.Domain;

public sealed class PerformanceReviewTests
{
    [Fact]
    public void Submit_SelfReview_PersistsResponsesAgainstFrozenDefinition()
    {
        var tenantId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var employeeId = Guid.NewGuid();
        var definition = FormalReviewDefinitionSnapshot.Create(
            tenantId,
            cycleId,
            FormalReviewKind.Self,
            "Self review",
            [new ReviewCriterionDefinition("Delivery", "Delivered agreed work", 1)],
            "Five point",
            [new RatingScaleLevelDefinition(1, "Needs improvement"), new RatingScaleLevelDefinition(5, "Exceptional")],
            DateTime.UtcNow);
        var review = PerformanceReview.Create(
            tenantId, cycleId, Guid.NewGuid(), employeeId, employeeId, FormalReviewKind.Self, definition.Id);

        review.Submit(
            [new ReviewCriterionResponse(definition.Criteria.Single().Id, 5, "Delivered ahead of schedule")],
            "Strong delivery this period",
            "https://evidence.example/release",
            DateTime.UtcNow);

        Assert.Equal(FormalReviewStatus.Submitted, review.Status);
        Assert.Equal(5, review.Criteria.Single().Rating);
        Assert.Equal("Strong delivery this period", review.Narrative);
        Assert.Equal(definition.Id, review.DefinitionSnapshotId);
    }

    [Fact]
    public void Finalize_ManagerReview_LocksOutcomeAndCreatesSeparateCorrectionTask()
    {
        var tenantId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var managerId = Guid.NewGuid();
        var definition = FormalReviewDefinitionSnapshot.Create(
            tenantId,
            cycleId,
            FormalReviewKind.Manager,
            "Manager review",
            [new ReviewCriterionDefinition("Impact", "Business impact", 1)],
            "Five point",
            [new RatingScaleLevelDefinition(1, "Needs improvement"), new RatingScaleLevelDefinition(5, "Exceptional")],
            DateTime.UtcNow);
        var review = PerformanceReview.Create(
            tenantId, cycleId, Guid.NewGuid(), subjectId, managerId, FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 4, "Strong impact")], "Manager assessment", null, DateTime.UtcNow);

        review.FinalizeOutcome(DateTime.UtcNow);
        var correction = review.RequestCorrection(DateTime.UtcNow.AddMinutes(1), "Correct factual evidence", DateTime.UtcNow.AddDays(3));

        Assert.Equal(FormalReviewStatus.Finalized, review.Status);
        Assert.True(review.IsLocked);
        Assert.Equal(CampaignWorkItemType.Correction, correction.Type);
        Assert.Equal(managerId, correction.AssigneeEmployeeId);
        Assert.Equal(subjectId, correction.SubjectEmployeeId);
    }

    [Fact]
    public void Submit_FinalizedReview_IsRejected()
    {
        var definition = FormalReviewDefinitionSnapshot.Create(
            Guid.NewGuid(), Guid.NewGuid(), FormalReviewKind.Manager, "Manager review",
            [new ReviewCriterionDefinition("Impact", "Business impact", 1)],
            "Five point", [new RatingScaleLevelDefinition(1, "Needs improvement")], DateTime.UtcNow);
        var review = PerformanceReview.Create(
            definition.TenantId, definition.CycleId, Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), FormalReviewKind.Manager, definition.Id);
        review.Submit([new ReviewCriterionResponse(definition.Criteria.Single().Id, 1, "Assessment")], "Narrative", null, DateTime.UtcNow);
        review.FinalizeOutcome(DateTime.UtcNow);

        Assert.Throws<DomainRuleViolationException>(() => review.Submit(
            [new ReviewCriterionResponse(definition.Criteria.Single().Id, 1, "Changed")], "Changed", null, DateTime.UtcNow));
    }
}
