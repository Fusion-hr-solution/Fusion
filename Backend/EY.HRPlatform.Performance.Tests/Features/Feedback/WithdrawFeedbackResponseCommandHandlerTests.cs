using EY.HRPlatform.Performance.Domain.Entities;
using EY.HRPlatform.Performance.Domain.Enums;
using EY.HRPlatform.Performance.Features.Feedback.Commands.WithdrawFeedbackResponse;
using EY.HRPlatform.Performance.Tests.TestSupport;

namespace EY.HRPlatform.Performance.Tests.Features.Feedback;

public sealed class WithdrawFeedbackResponseCommandHandlerTests
{
    [Fact]
    public async Task Withdraw_Success_SubmittedResponse_StatusBecomesDraft()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var now = DateTime.UtcNow;
        var content = CreateSubmittedContent(tenantId);
        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, Guid.NewGuid(), reviewerId);
        db.AddRange(content, mapping);
        await db.SaveChangesAsync();
        var handler = new WithdrawFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new WithdrawFeedbackResponseCommand(content.Id), default);

        Assert.True(result.IsSuccess);
        Assert.Equal(FeedbackResponseStatus.Draft, content.Status);
    }

    [Fact]
    public async Task Withdraw_NotFound_InvalidResponseId_ReturnsNotFound()
    {
        var tenantId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var handler = new WithdrawFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = Guid.NewGuid() });

        var result = await handler.Handle(new WithdrawFeedbackResponseCommand(Guid.NewGuid()), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotFound", result.Error.Code);
    }

    [Fact]
    public async Task Withdraw_WrongOwner_DifferentEmployee_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var otherId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateSubmittedContent(tenantId);
        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, Guid.NewGuid(), reviewerId);
        db.AddRange(content, mapping);
        await db.SaveChangesAsync();
        var handler = new WithdrawFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = otherId });

        var result = await handler.Handle(new WithdrawFeedbackResponseCommand(content.Id), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("NotOwner", result.Error.Code);
    }

    [Fact]
    public async Task Withdraw_NotSubmitted_DraftStatus_ReturnsForbidden()
    {
        var tenantId = Guid.NewGuid();
        var reviewerId = Guid.NewGuid();
        var db = PerformanceTestContext.Create(tenantId, out _);
        var content = CreateDraftContent(tenantId);
        var mapping = FeedbackIdentityMapping.Create(tenantId, content.Id, Guid.NewGuid(), reviewerId);
        db.AddRange(content, mapping);
        await db.SaveChangesAsync();
        var handler = new WithdrawFeedbackResponseCommandHandler(db, new StubCurrentUserContext { EmployeeId = reviewerId });

        var result = await handler.Handle(new WithdrawFeedbackResponseCommand(content.Id), default);

        Assert.False(result.IsSuccess);
        Assert.Contains("InvalidStatus", result.Error.Code);
    }

    private static FeedbackResponseContent CreateSubmittedContent(Guid tenantId)
    {
        var content = FeedbackResponseContent.Create(tenantId, Guid.NewGuid(), Guid.NewGuid(), CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
        content.Submit(DateTime.UtcNow);
        return content;
    }

    private static FeedbackResponseContent CreateDraftContent(Guid tenantId)
        => FeedbackResponseContent.Create(tenantId, Guid.NewGuid(), Guid.NewGuid(), CampaignWorkItemType.PeerFeedback, Guid.NewGuid(),
            [new FeedbackPromptAnswerInput(Guid.NewGuid(), "Q1", 1, "Answer", true)]);
}
