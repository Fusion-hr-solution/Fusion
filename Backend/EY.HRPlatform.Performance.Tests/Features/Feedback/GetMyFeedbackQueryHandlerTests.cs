using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Queries.GetMyFeedback;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class GetMyFeedbackQueryHandlerTests
{
    [Fact]
    public async Task GetMyFeedback_AssignedReviewerWithResponse_ReturnsLatestCommentAndAnswers()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);

        var workItem = CampaignWorkItem.Create(
            tenantId,
            cycleId,
            subjectId,
            reviewerId,
            CampaignWorkItemType.PeerFeedback,
            DateTime.UtcNow.AddDays(7));

        var content = FeedbackResponseContent.Create(
            tenantId,
            cycleId,
            subjectId,
            CampaignWorkItemType.PeerFeedback,
            Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Submitted answer", true)]);
        content.Submit(DateTime.UtcNow);

        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, workItem.Id, reviewerId);
        var version1 = FeedbackResponseVersion.Create(
            tenantId,
            content.Id,
            1,
            "[]",
            "First draft",
            reviewerId);
        var version2 = FeedbackResponseVersion.Create(
            tenantId,
            content.Id,
            2,
            "[]",
            "Latest comment",
            reviewerId);

        db.AddRange(workItem, content, mapping, version1, version2);
        await db.SaveChangesAsync();

        var handler = new GetMyFeedbackQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new GetMyFeedbackQuery(workItem.Id), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(content.Id, result.Value.Id);
        Assert.Equal("Latest comment", result.Value.GeneralComment);
        var answer = Assert.Single(result.Value.Answers);
        Assert.Equal("Submitted answer", answer.AnswerText);
    }

    [Fact]
    public async Task GetMyFeedback_NotAssignedReviewer_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var otherReviewerId = Guid.NewGuid();
        var subjectId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);

        var workItem = CampaignWorkItem.Create(
            tenantId,
            cycleId,
            subjectId,
            reviewerId,
            CampaignWorkItemType.PeerFeedback,
            DateTime.UtcNow.AddDays(7));

        db.CampaignWorkItems.Add(workItem);
        await db.SaveChangesAsync();

        var handler = new GetMyFeedbackQueryHandler(
            db,
            new StubCurrentUserContext { EmployeeId = otherReviewerId });

        var result = await handler.Handle(new GetMyFeedbackQuery(workItem.Id), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotAssigned", result.Error.Code);
    }
}
